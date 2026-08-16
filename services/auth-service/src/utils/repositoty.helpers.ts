import { Knex } from "knex";
import { getAuthDatabaseShard } from "@root/infrastructure/db";

import { IRefreshToken, IRefreshTokenRow } from "@root/modules/token";

export function resolveDatabase(userId: string, isRead: boolean = false): Knex {
    const currShard = getAuthDatabaseShard(userId);
    if (isRead && currShard.replica) return currShard.replica;
    return currShard.primary;
}

export function convertToCamelCase(refreshToken: IRefreshTokenRow): IRefreshToken {
    return {
        id: refreshToken.id,
        sessionId: refreshToken.session_id,
        tokenHash: refreshToken.token_hash,
        replacedBy: refreshToken.replaced_by,
        expiresAt: refreshToken.expires_at,
        createdAt: refreshToken.created_at,
        revokedAt: refreshToken.revoked_at,
    };
}