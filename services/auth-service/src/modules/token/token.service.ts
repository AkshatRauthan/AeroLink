import jwt from 'jsonwebtoken';
import { uuidv7 } from 'uuidv7';
import { createHmac, timingSafeEqual } from 'crypto';

import { ServerConfig } from '@root/config';
import { CustomError } from '@aerolink/shared';
import { hashToken, generateRawToken } from '@root/utils';
import { AuthCache, AuthCacheKeys } from '@root/infrastructure/cache';
import { RefreshTokenRepository } from './token.repository';
import { IRefreshToken, IAccessToken } from './token.types';


function signRefreshToken(rawToken: string): string {
    const signature = createHmac('sha256', ServerConfig.REFRESH_TOKEN_SECRET)
        .update(rawToken)
        .digest('hex');
    return `${rawToken}.${signature}`;
}
function verifyRefreshTokenSignature(signedToken: string): string {
    const [rawToken, signature] = signedToken.split('.');
    if (!rawToken || !signature) {
        throw new CustomError('Malformed refresh token', 401, true);
    }

    const expectedSignature = createHmac('sha256', ServerConfig.REFRESH_TOKEN_SECRET)
        .update(rawToken)
        .digest('hex');

    const sigBuf = new Uint8Array(Buffer.from(signature, 'hex'));
    const expectedBuf = new Uint8Array(Buffer.from(expectedSignature, 'hex'));

    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
        throw new CustomError('Refresh token signature invalid', 401, true);
    }

    return rawToken;
}

export const TokenService = {

    async issueRefreshToken(sessionId: string, userId: string): Promise<{ signedToken: string, tokenId: string }> {
        const rawToken = generateRawToken();
        const tokenHash = hashToken(rawToken);
        const id = uuidv7();
        const expiresAt = new Date(Date.now() + ServerConfig.REFRESH_TOKEN_EXPIRY * 1000);

        await RefreshTokenRepository.create(
            { id, sessionId, tokenHash, expiresAt },
            userId,
        )

        return { signedToken: signRefreshToken(rawToken), tokenId: id };
    },


    async validateRefreshToken(signedToken: string, userId: string): Promise<IRefreshToken> {
        const rawToken = verifyRefreshTokenSignature(signedToken);
        const tokenHash = hashToken(rawToken);
        const token = await RefreshTokenRepository.findByTokenHash(tokenHash, userId);

        if (!token) {
            throw new CustomError('Invalid refresh token', 401, true);
        }
        if (token.revokedAt !== null) {
            throw new CustomError('Refresh token has been revoked', 401, true);
        }
        if (token.expiresAt < new Date()) {
            throw new CustomError('Refresh token has expired', 401, true);
        }

        return token;
    },


    async rotateRefreshToken(oldSignedToken: string, sessionId: string, userId: string,): Promise<string> {
        const oldToken = await this.validateRefreshToken(oldSignedToken, userId);
        const { signedToken: newSignedToken, tokenId: newTokenId } = await this.issueRefreshToken(sessionId, userId);

        await RefreshTokenRepository.update(oldToken.id, { replacedBy: newTokenId, revokedAt: new Date() }, userId);
        return newSignedToken;
    },


    async revokeRefreshToken(tokenId: string, userId: string): Promise<void> {
        await RefreshTokenRepository.revoke(tokenId, userId);
    },


    async revokeAllRefreshTokensForSession(sessionId: string, userId: string): Promise<void> {
        await RefreshTokenRepository.revokeAllBySessionId(sessionId, userId);
    },


    async detectTokenTheft(signedToken: string, userId: string): Promise<string | null> {
        let rawToken: string;
        try {
            rawToken = verifyRefreshTokenSignature(signedToken);
        } catch {
            return null; // malformed/bad signature isn't reuse, it's just invalid
        }

        const tokenHash = hashToken(rawToken);
        const token = await RefreshTokenRepository.findByTokenHash(tokenHash, userId);

        if (!token) return null; // unknown token, not a reuse case
        if (token.revokedAt === null) return null; // still active, no reuse
        if (token.replacedBy === null) return null; // revoked via logout, not token rotation — not reuse

        return token.sessionId;
    },


    generateAccessToken(payload: Pick<IAccessToken, 'sub' | 'role' | 'sessionId'>): string {
        const jti = uuidv7();

        return jwt.sign(
            {
                sub: payload.sub,
                role: payload.role,
                sessionId: payload.sessionId,
                jti,
            },
            ServerConfig.JWT_ACCESS_SECRET,
            { expiresIn: ServerConfig.JWT_ACCESS_EXPIRY },
        );
    },


    /**
     * Now async: JWT verification is still a pure, synchronous check, but
     * this now also consults the sessionId blacklist afterwards — a
     * revoked session's access tokens are rejected immediately rather than
     * staying valid until their natural JWT expiry. Every caller (gRPC
     * ValidateToken server, any middleware) needs to await this now.
     *
     * jwt.verify throws distinct error types depending on failure —
     * jwt.TokenExpiredError for expiry, jwt.JsonWebTokenError for a bad
     * signature/malformed token. These are distinguished here and thrown
     * as separate CustomError messages, rather than collapsed into one
     * generic message, so callers (e.g. the gRPC handler) can tell an
     * expired token apart from a genuinely invalid one and a blacklisted
     * one without re-parsing the error themselves.
     */
    async verifyAccessToken(token: string): Promise<IAccessToken> {
        let decoded: IAccessToken;
        try {
            decoded = jwt.verify(token, ServerConfig.JWT_ACCESS_SECRET) as unknown as IAccessToken;
        } catch (err) {
            if (err instanceof jwt.TokenExpiredError) {
                throw new CustomError('Access token has expired', 401, true);
            }
            throw new CustomError('Invalid access token', 401, true);
        }

        const isBlacklisted = await AuthCache.exists(AuthCacheKeys.blacklistedSession(decoded.sessionId));
        if (isBlacklisted) {
            throw new CustomError('Access token has been revoked', 401, true);
        }

        return decoded;
    },

}