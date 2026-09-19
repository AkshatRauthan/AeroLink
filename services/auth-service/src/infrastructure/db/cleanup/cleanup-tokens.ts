import type { Knex } from 'knex';
import { CleanupConfig } from '@root/config';

const TABLE = 'refresh_tokens';

/**
 * Deletes refresh tokens that are either revoked or expired, and past
 * the grace period since that event. Same revoked_at/expires_at timing
 * logic as cleanupExpiredSessions, but runs independently — a token
 * that rotated out weeks ago is eligible for deletion even if its
 * parent session is still active, since normal rotation revokes the
 * old token on every refresh regardless of session lifetime.
 */
export const cleanupExpiredRefreshTokens = async (db: Knex): Promise<number> => {
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