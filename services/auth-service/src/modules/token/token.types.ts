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