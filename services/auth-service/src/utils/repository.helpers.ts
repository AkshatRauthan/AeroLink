import { Knex } from "knex";
import { CustomError } from "@aerolink/shared";
import { getAuthDatabaseShard } from "@root/infrastructure/db";

import type { ISession, ISessionRow } from "@root/modules/session";
import type { IRefreshToken, IRefreshTokenRow } from "@root/modules/token";
import type { IUser, IUserRow, IUserProfile, IUserProfileRow } from "@root/modules/auth";

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

type RowType = IRefreshTokenRow | ISessionRow | IUserRow | IUserProfileRow;
type OutputType = IRefreshToken | ISession | IUser | IUserProfile;

function isRefreshTokenRow(
    row: RowType
): row is IRefreshTokenRow {
    return "token_hash" in row;
}

function isSessionRow(
    row: RowType
): row is ISessionRow {
    return "user_id" in row;
}

function isUserRow(
    row: RowType
): row is IUserRow {
    return "password" in row && "email" in row && "phone_no" in row;
}

function isUserProfileRow(
    row: RowType
): row is IUserProfileRow {
    return "first_name" in row && "last_name" in row && "address" in row;
}

export function convertToCamelCase(row: IUserRow): IUser;
export function convertToCamelCase(row: ISessionRow): ISession;
export function convertToCamelCase(row: IUserProfileRow): IUserProfile;
export function convertToCamelCase(row: IRefreshTokenRow): IRefreshToken;

export function convertToCamelCase(row: RowType): OutputType {
    if (isRefreshTokenRow(row)) {
        return {
            id: binaryToUuid(row.id),
            sessionId: binaryToUuid(row.session_id),
            tokenHash: row.token_hash,
            replacedBy: (row.replaced_by ? binaryToUuid(row.replaced_by) : null),
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

    if (isUserRow(row)) {
        return {
            id: binaryToUuid(row.id),
            email: row.email,
            phoneNo: row.phone_no,
            password: row.password,
            role: row.role,
            lastLoginAt: row.last_login_at,
            emailVerified: row.email_verified,
            phoneVerified: row.phone_verified,
            profileCreated: row.profile_created,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }
    }

    if (isUserProfileRow(row)) {
        return {
            id: binaryToUuid(row.id),
            firstName: row.first_name,
            middleName: row.middle_name,
            lastName: row.last_name,
            address: row.address,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }
    }

    throw new CustomError("Unsupported row type encountered", 500, true);
}