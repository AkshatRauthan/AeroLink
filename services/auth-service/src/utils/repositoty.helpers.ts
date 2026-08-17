import { Knex } from "knex";
import { CustomError } from "@aerolink/shared";
import { getAuthDatabaseShard } from "@root/infrastructure/db";

import type { ISession, ISessionRow } from "@root/modules/session";
import type { IRefreshToken, IRefreshTokenRow } from "@root/modules/token";

export function resolveDatabase(userId: string, isRead: boolean = false): Knex {
    const currShard = getAuthDatabaseShard(userId);
    if (isRead && currShard.replica) return currShard.replica;
    return currShard.primary;
}

export function uuidToBinary(uuid: string): Buffer {
    return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

export function binaryToUuid(buffer: Buffer): string {
    const hex = buffer.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/*
 *  convertToCamelCase function overrides
 */

function isRefreshTokenRow(
    row: IRefreshTokenRow | ISessionRow
): row is IRefreshTokenRow {
    return "token_hash" in row;
}

function isSessionRow(
    row: IRefreshTokenRow | ISessionRow
): row is ISessionRow {
    return "user_id" in row;
}

export function convertToCamelCase(row: ISessionRow): ISession;
export function convertToCamelCase(row: IRefreshTokenRow): IRefreshToken;

export function convertToCamelCase(row: IRefreshTokenRow | ISessionRow): IRefreshToken | ISession {
    if (isRefreshTokenRow(row)) {
        return {
            id: binaryToUuid(row.id),
            sessionId: binaryToUuid(row.session_id),
            tokenHash: row.token_hash,
            replacedBy: row.replaced_by,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
            revokedAt: row.revoked_at,
        };
    }

    if (isSessionRow(row)) {
        return {
            id: binaryToUuid(row.id),
            userId: binaryToUuid(row.user_id),
            ipAddress: row.ip_address,
            deviceInfo: row.device_info,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
            revokedAt: row.revoked_at,
            lastActiveAt: row.last_active_at,
        };
    }

    throw new CustomError("Unsupported row type encountered", 500, true);
}