import jwt from 'jsonwebtoken';
import { uuidv7 } from 'uuidv7';
import { createHmac } from 'crypto';

import { ServerConfig } from '@root/config';
import { CustomError } from '@aerolink/shared';
import { hashToken, generateRawToken } from '@root/utils';
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

    if (signature !== expectedSignature) {
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

        await RefreshTokenRepository.update(oldToken.id, { replacedBy: newTokenId }, userId);
        await RefreshTokenRepository.revoke(oldToken.id, userId);

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


    verifyAccessToken(token: string): IAccessToken {
        try {
            const decoded = jwt.verify(token, ServerConfig.JWT_ACCESS_SECRET);
            return decoded as unknown as IAccessToken;
        } catch {
            throw new CustomError('Invalid or expired access token', 401, true);
        }
    },

}