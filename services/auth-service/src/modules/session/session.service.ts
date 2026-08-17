import { uuidv7 } from 'uuidv7';
import { ServerConfig } from '@root/config';
import { CustomError } from '@aerolink/shared';

import { UserRole } from '@root/modules/auth';
import { TokenService } from "@root/modules/token";
import { SessionRepository } from './session.repository';
import { ISession, CreateSessionInput, SessionTokenPair } from './session.types';


export const SessionService = {
    /**
     * Creates a new session on login: persists the session row (with device/IP
     * metadata), then issues a refresh token scoped to that session via the
     * token module, and signs an access token. Returns both tokens plus the
     * session record. This is the only place a session is created — auth's
     * login controller should call this rather than touching token/session
     * repositories directly.
     */
    async createSession(input: CreateSessionInput): Promise<SessionTokenPair> {
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

        return { accessToken, refreshToken, session };
    },


    /**
     * Refreshes a session: checks for token theft first (a reused/already-
     * revoked token presented again), and if detected, revokes the entire
     * session immediately and throws rather than issuing new tokens. If the
     * token is clean, rotates it (old token consumed, new one issued) and
     * bumps the session's lastActiveAt, then signs a fresh access token.
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

        const accessToken = TokenService.generateAccessToken({ sub: userId, role, sessionId });

        return { accessToken, refreshToken: newRefreshToken };
    },


    /** Lists all sessions for a user — e.g. for a "manage your devices" UI. Includes revoked sessions; filter in the caller if only active ones are wanted. */
    async getSessionsForUser(userId: string): Promise<ISession[]> {
        return SessionRepository.findAllByUserId(userId);
    },


    /** Revokes a single session and every refresh token issued under it. */
    async revokeSession(sessionId: string, userId: string): Promise<void> {
        await TokenService.revokeAllRefreshTokensForSession(sessionId, userId);
        await SessionRepository.revoke(sessionId, userId);
    },


    /** Revokes every session for a user — "logout everywhere". Each session's tokens are revoked individually first. */
    async revokeAllSessionsForUser(userId: string): Promise<void> {
        const sessions = await SessionRepository.findAllByUserId(userId);

        for (const session of sessions) {
            if (session.revokedAt === null) {
                await TokenService.revokeAllRefreshTokensForSession(session.id, userId);
            }
        }

        await SessionRepository.revokeAllByUserId(userId);
    },

}