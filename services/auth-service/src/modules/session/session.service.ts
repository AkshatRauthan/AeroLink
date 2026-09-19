import { uuidv7 } from 'uuidv7';
import { ServerConfig } from '@root/config';
import { CustomError } from '@aerolink/shared';

import { UserRole } from '@root/modules/auth';
import { TokenService } from "@root/modules/token";
import { AuthCache, AuthCacheKeys, AuthCacheTTL } from '@root/infrastructure/cache';
import { SessionRepository } from './session.repository';
import { CreateSessionInput, SessionTokenPair, ISanitizedSession } from './session.types';
import {StatusCodes} from "http-status-codes";


export const SessionService = {
    /**
     * Creates a new session on login: enforces the max-concurrent-sessions
     * limit first (evicting the least-recently-active session via the
     * userId --> sessions sorted set if at capacity), then persists the new
     * session row, issues a refresh token via the token module, and signs
     * an access token. Returns both tokens plus the session record. This
     * is the only place a session is created — auth's login controller
     * should call this rather than touching token/session repositories
     * directly.
     */
    async createSession(input: CreateSessionInput): Promise<SessionTokenPair> {
        const sessionsKey = AuthCacheKeys.userSessions(input.userId);

        // checkAndEvictLru does the "at capacity? find oldest? remove it"
        // sequence as one atomic Redis-side operation, so two concurrent
        // logins for the same user can't both read the same victim from
        // separate zCard/zRange calls and both act on it — see cache.manager.ts.
        const lruEvictedSessionId = await AuthCache.checkAndEvictLru(sessionsKey, ServerConfig.MAX_CONCURRENT_SESSIONS_PER_USER);
        if (lruEvictedSessionId) {
            // The sorted-set removal already happened atomically above;
            // revokeSession still handles the DB row, refresh tokens, and
            // blacklist entry for that victim. Its own AuthCache.pull call
            // becomes a harmless no-op here since the member is already gone.
            await this.revokeSession(lruEvictedSessionId, input.userId);
        }

        const id = uuidv7();
        const expiresAt = new Date(Date.now() + ServerConfig.REFRESH_TOKEN_EXPIRY * 1000);

        const session = await SessionRepository.create({
            id,
            userId: input.userId,
            ipAddress: input.ipAddress,
            deviceInfo: input.deviceInfo,
            expiresAt,
        });

        const { signedToken: refreshToken } = await TokenService.issueRefreshToken(session.id, input.userId);
        const accessToken = TokenService.generateAccessToken({
            sub: input.userId,
            role: input.role,
            sessionId: session.id,
        });

        await AuthCache.push(sessionsKey, session.id, Date.now(), AuthCacheTTL.userSessionTTL);

        return { accessToken, refreshToken, session };
    },


    /**
     * Verifies a session: checks if it is present in the storage, is revoked,
     * or has it expired. If passes all checks then returns true else it returns false.
     * Never throws.
     */
    async verifySession(sessionId: string, userId: string): Promise<boolean> {
        const session = await SessionRepository.findById(sessionId, userId);
        if (!session) return false;
        if (session.userId !== userId) return false;
        if (session.revokedAt != null) return false;
        return session.expiresAt >= new Date();
    },


    /**
     * Refreshes a session: checks for token theft first (a revoked
     * token that is now replaced presented again), and if detected, revokes the entire
     * session immediately and throws rather than issuing new tokens. If the
     * token is clean, rotates it (old token consumed, new one issued) and
     * bumps the session's lastActiveAt, then signs a fresh access token.
     * The sorted-set score is bumped in the same call (write-through) so
     * the LRU ordering used for eviction stays accurate without waiting on
     * a TTL to lapse.
     */
    async refreshSession(
        oldRefreshToken: string,
        sessionId: string,
        userId: string,
        role: UserRole,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const theftSessionId = await TokenService.detectTokenTheft(oldRefreshToken, userId);
        if (theftSessionId !== null) {
            await this.revokeSession(theftSessionId, userId);
            throw new CustomError('Refresh token reuse detected — session revoked', 401, true);
        }

        const newRefreshToken = await TokenService.rotateRefreshToken(oldRefreshToken, sessionId, userId);
        await SessionRepository.touch(sessionId, userId);
        await AuthCache.push(AuthCacheKeys.userSessions(userId), sessionId, Date.now(), AuthCacheTTL.userSessionTTL);

        const accessToken = TokenService.generateAccessToken({ sub: userId, role, sessionId });
        return { accessToken, refreshToken: newRefreshToken };
    },


    /** Lists all active sessions for a user — e.g. for a "manage your devices" UI. */
    async getAllUserSessions(userId: string, currSessionId: string): Promise<ISanitizedSession[]> {
        const sessions = await SessionRepository.findAllByUserId(userId);

        return sessions.map((session):ISanitizedSession => ({
            id: session.id,
            ipAddress: session.ipAddress,
            deviceInfo: session.deviceInfo,
            createdAt: session.createdAt,
            lastActiveAt: session.lastActiveAt,
            isCurrentSession: session.id === currSessionId,
        }));
    },


    /**
     * Revokes a single session and every refresh token issued under it,
     * blacklists the sessionId, and pulls it out of the userId->sessions
     * sorted set. Used directly for logout, and reused as-is by both LRU
     * eviction (above) and theft-detected revoke (below) — same revoke
     * semantics regardless of caller.
     */
    async revokeSession(sessionId: string, userId: string): Promise<void> {
        const flag = await this.verifySession(sessionId, userId);
        if (!flag) {
            throw new CustomError('Invalid sessionId provided', StatusCodes.NOT_FOUND);
        }

        await TokenService.revokeAllRefreshTokensForSession(sessionId, userId);
        await SessionRepository.revoke(sessionId, userId);
        await AuthCache.set(AuthCacheKeys.blacklistedSession(sessionId), true, AuthCacheTTL.blacklistedSessionTTL);
        await AuthCache.pull(AuthCacheKeys.userSessions(userId), sessionId);
    },


    /**
     * Revokes every session for a user — "logout everywhere". Each
     * still-active session's tokens are revoked and blacklisted in the same
     * pass, then the whole userId->sessions sorted set is dropped in one
     * call rather than pulled member-by-member, since every entry in it is
     * being invalidated anyway.
     */
    async revokeAllUserSessions(userId: string): Promise<void> {
        const sessions = await SessionRepository.findAllByUserId(userId);

        for (const session of sessions) {
            if (session.revokedAt === null) {
                await TokenService.revokeAllRefreshTokensForSession(session.id, userId);
                await AuthCache.set(AuthCacheKeys.blacklistedSession(session.id), true, AuthCacheTTL.blacklistedSessionTTL);
            }
        }

        await SessionRepository.revokeAllByUserId(userId);
        await AuthCache.invalidate(AuthCacheKeys.userSessions(userId));
    },

}