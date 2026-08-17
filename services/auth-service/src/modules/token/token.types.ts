import { UserRole } from '@root/modules/auth';

/**
 *  Access Token: Stateless with jti
 */
export interface IAccessToken {
    sub: string;
    role: UserRole;
    sessionId: string;

    iat: Date;
    exp: Date;
    jti: string;
}


/**
 *  Refresh Token: Statefull [for implementing server side token expiration]
 */
export interface IRefreshToken {
    id: string;
    sessionId: string;
    tokenHash: string;
    replacedBy: string | null;

    expiresAt: Date;
    createdAt: Date;
    revokedAt: Date | null;
}
export interface IRefreshTokenRow {
    id: Buffer;
    session_id: Buffer;
    token_hash: string;
    replaced_by: string | null;

    expires_at: Date;
    created_at: Date;
    revoked_at: Date | null;
}

export type CreateNewTokenInput = Omit<IRefreshToken, 'replacedBy' | 'revokedAt' | 'createdAt'>;
export type CreateNewRowInput = Omit<IRefreshTokenRow, 'created_at' | 'replaced_by' | 'revoked_at'>