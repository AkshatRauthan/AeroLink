import { CustomError } from '@aerolink/shared';
import { resolveDatabase, convertToCamelCase } from '@root/utils';
import { IRefreshToken, IRefreshTokenRow, CreateNewTokenInput, CreateNewRowInput } from './token.types';

const TABLE = "refresh_tokens";

/**
 *  Here, all the repo functions directly refer to shard.primary in each case by passing default value false
 *  for isRead parameter in resolveDatabase function.
 * 
 *  This is done because during token verification, we can't afford to read a stale value from a replica in 
 *  case of any replication lag. We need to ensure that every time we read the correct value. 
 *  So, here our correctness concern overweight our primary's load reducing concern. 
 *  [DB itself is becomes meaningless if we are getting stale value when we want to be 100% sure.]
 */

export const RefreshTokenRepository = {
    
    async findById(id: string, userId: string): Promise<IRefreshToken | null> {
        const db = resolveDatabase(userId);
        const refreshToken = await db<IRefreshTokenRow>(TABLE).where({ id }).first();

        if (!refreshToken) return null;
        return convertToCamelCase(refreshToken);
    },


    async findByTokenHash(tokenHash: string, userId: string): Promise<IRefreshToken | null> {
        const db = resolveDatabase(userId);
        const refreshToken = await db<IRefreshTokenRow>(TABLE).where({ token_hash: tokenHash }).first();

        if (!refreshToken) return null;
        return convertToCamelCase(refreshToken);
    },


    async findAllBySessionId(sessionId: string, userId: string): Promise<IRefreshToken[]> {
        const db = resolveDatabase(userId);
        const rows = await db<IRefreshTokenRow>(TABLE).where({ session_id: sessionId }).orderBy("created_at", "desc");
        return rows.map(convertToCamelCase);
    },


    /**
     * @param data The refreshToken data object having fields: id, sessionId, tokenHash, expiresAt
     * @returns The newly generated refreshToken
     */
    async create(data: CreateNewTokenInput, userId: string): Promise<IRefreshToken> {
        const db = resolveDatabase(userId);
        const row: CreateNewRowInput = {
            id: data.id,
            session_id: data.sessionId,
            token_hash: data.tokenHash,
            expires_at: data.expiresAt,
        }
        await db<IRefreshTokenRow>(TABLE).insert(row);

        const inserted = await db<IRefreshTokenRow>(TABLE).where({ id: data.id }).first();
        if (!inserted) throw new CustomError('Failed to create refresh token', 500, false);
        return convertToCamelCase(inserted);
    },


    /**
     *  Updates the following fields of the refresh token: replacedBy, revokedAt, expiresAt, tokenHash
     */
    async update(id: string, data: Partial<IRefreshToken>, userId: string): Promise<void> {
        const db = resolveDatabase(userId);
        const row: Partial<IRefreshTokenRow> = {};

        if (data.replacedBy !== undefined) row.replaced_by = data.replacedBy;
        if (data.revokedAt !== undefined) row.revoked_at = data.revokedAt;
        if (data.expiresAt !== undefined) row.expires_at = data.expiresAt;
        if (data.tokenHash !== undefined) row.token_hash = data.tokenHash;
        if (Object.keys(row).length === 0) return;

        await db<IRefreshTokenRow>(TABLE)
            .where({ id })
            .update(row);
    },


    async revoke(id: string, userId: string): Promise<void> {
        const db = resolveDatabase(userId);
        await db<IRefreshTokenRow>(TABLE)
            .where({ id })
            .update({ revoked_at: new Date() });
    },


    /**
     *  Sets revokedId of all refresh tokens tied to the given sessionId where it is currently NULL
     */
    async revokeAllBySessionId(sessionId: string, userId: string): Promise<void> {
        const db = resolveDatabase(userId);
        await db<IRefreshTokenRow>(TABLE)
            .where({ session_id: sessionId })
            .whereNull('revoked_at')
            .update({ revoked_at: new Date() });
    },
}