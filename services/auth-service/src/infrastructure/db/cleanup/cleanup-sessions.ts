import type { Knex } from 'knex';
import { CleanupConfig } from '@root/config';

const TABLE = 'sessions';

/**
 * Deletes sessions that are either revoked or expired, and past the
 * grace period since that event — revoked rows are timed off
 * revoked_at, non-revoked-but-expired rows off expires_at. A session
 * still within its grace window is left alone even if it's long dead,
 * so there's a debugging window before permanent deletion.
 *
 * Runs in batches (DB_CLEANUP_MAX_BATCH_SIZE at a time) rather than one
 * unbounded DELETE, to avoid holding a long-running lock on a
 * potentially large table. Returns the total number of rows deleted
 * across all batches for this shard.
 */
export const cleanupExpiredSessions = async (db: Knex): Promise<number> => {
    const graceSeconds = CleanupConfig.DB_CLEANUP_GRACE_PERIOD_SECONDS;
    let totalDeleted = 0;

    while (true) {
        const deleted = await db(TABLE)
            .where((builder) => {
                builder
                    .where((sub) =>
                        sub.whereNotNull('revoked_at')
                            .andWhere('revoked_at', '<', db.raw(`NOW() - INTERVAL ${graceSeconds} SECOND`)),
                    )
                    .orWhere((sub) =>
                        sub.whereNull('revoked_at')
                            .andWhere('expires_at', '<', db.raw(`NOW() - INTERVAL ${graceSeconds} SECOND`)),
                    );
            })
            .limit(CleanupConfig.DB_CLEANUP_MAX_BATCH_SIZE)
            .delete();

        totalDeleted += deleted;
        if (deleted < CleanupConfig.DB_CLEANUP_MAX_BATCH_SIZE) break;
    }

    return totalDeleted;
};