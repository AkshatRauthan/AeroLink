/**
 *  Session Schema Types
 */
export interface ISession {
    id: string;
    userId: string;

    ipAddress: string | null;
    deviceInfo: string | null;

    expiresAt: Date;
    createdAt: Date;
    revokedAt: Date | null;
    lastActiveAt: Date;
}