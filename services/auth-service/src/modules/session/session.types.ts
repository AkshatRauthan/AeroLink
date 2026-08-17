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

export interface ISessionRow {
    id: Buffer;
    user_id: Buffer;

    ip_address: string | null;
    device_info: string | null;

    expires_at: Date;
    created_at: Date;
    revoked_at: Date | null;
    last_active_at: Date;
}

export type CreateNewSessionInput = Pick<ISession, 'id' | 'userId' | 'ipAddress' | 'deviceInfo' | 'expiresAt'>;

export type CreateNewSessionRowInput = Pick<ISessionRow, 'id' | 'user_id' | 'ip_address' | 'device_info' | 'expires_at'>;


/**
 *  Session Service Types
 */
import { UserRole } from "@root/modules/auth";

export interface CreateSessionInput {
    userId: string;
    role: UserRole;
    ipAddress: string | null;
    deviceInfo: string | null;
}

export interface SessionTokenPair {
    accessToken: string;
    refreshToken: string;
    session: ISession;
}