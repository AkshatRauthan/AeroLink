import { CustomError } from '@aerolink/shared';
import { uuidToBinary, binaryToUuid, resolveDatabase, convertToCamelCase } from '@root/utils';
import { ISession, ISessionRow, CreateNewSessionInput, CreateNewSessionRowInput } from './session.types';

const TABLE = 'sessions';

export const SessionRepository = {

    async findById(id: string, userId: string): Promise<ISession | null> {
        const db = resolveDatabase(userId);
        const row = await db<ISessionRow>(TABLE)
            .where({ id: uuidToBinary(id) })
            .first();

        if (!row) return null;
        return convertToCamelCase(row);
    },


    async findAllByUserId(userId: string): Promise<ISession[]> {
        const db = resolveDatabase(userId, true);
        const rows = await db<ISessionRow>(TABLE)
            .where({ user_id: uuidToBinary(userId), revoked_at: null })
            .where('expires_at', '>', new Date())
            .orderBy('last_active_at', 'desc');

        return rows.map(row => convertToCamelCase(row));
    },


    /**
     * @param data The session data object having fields: id, userId, ipAddress, deviceInfo, expiresAt
     * @returns The newly created session
     */
    async create(data: CreateNewSessionInput): Promise<ISession> {
        const db = resolveDatabase(data.userId);
        const row: CreateNewSessionRowInput = {
            id: uuidToBinary(data.id),
            user_id: uuidToBinary(data.userId),
            ip_address: data.ipAddress,
            device_info: data.deviceInfo,
            expires_at: data.expiresAt,
        };

        await db<ISessionRow>(TABLE).insert(row);

        const inserted = await db<ISessionRow>(TABLE).where({ id: row.id }).first();
        if (!inserted) throw new CustomError('Failed to create a new session', 500);
        return convertToCamelCase(inserted);
    },


    /** Bumps lastActiveAt to now — call on each authenticated request/refresh to track session activity. */
    async touch(id: string, userId: string): Promise<void> {
        const db = resolveDatabase(userId);
        const matchedCount = await db<ISessionRow>(TABLE)
            .where({ id: uuidToBinary(id) })
            .update({ last_active_at: new Date() });

        if (matchedCount === 0) throw new CustomError("Session to be touched is not found", 404);
    },


    async revoke(id: string, userId: string): Promise<void> {
        const db = resolveDatabase(userId);
        const matchedCount = await db<ISessionRow>(TABLE)
            .where({ id: uuidToBinary(id) })
            .update({ revoked_at: new Date() });

        if (matchedCount === 0) throw new CustomError("Session to be revoked is not found", 404);
    },


    /** Revokes every active session belonging to a user — used for "logout everywhere". */
    async revokeAllByUserId(userId: string): Promise<void> {
        const db = resolveDatabase(userId);
        const matchedCount = await db<ISessionRow>(TABLE)
            .where({ user_id: uuidToBinary(userId) })
            .whereNull('revoked_at')
            .update({ revoked_at: new Date() });
    },

};