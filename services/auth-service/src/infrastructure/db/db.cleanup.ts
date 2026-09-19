import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { Logger, CustomError } from '@aerolink/shared';
import { closeAuthDatabaseConnections, getAllAuthPrimaryPools } from './auth-db.manager';
import {
    cleanupExpiredSessions, cleanupExpiredRefreshTokens
} from './cleanup';

/**
 * Deletes revoked/expired sessions and refresh tokens, past their grace
 * period, on every Auth primary shard. Meant to be invoked by an
 * external cron (or equivalent scheduler), not run in-process inside
 * the live service — same pattern as migrate.ts.
 */
const run = async (): Promise<void> => {
    const pools = getAllAuthPrimaryPools();
    const primaryPools = pools.entries();

    if (pools.length <= 0) {
        throw new CustomError(
            'No auth primary sharding reachable for cleanup job', 500, true
        );
    }

    for (const [shardIndex, primary] of primaryPools) {
        const sessionsDeleted = await cleanupExpiredSessions(primary);
        const tokensDeleted = await cleanupExpiredRefreshTokens(primary);

        Logger.info(
            `Auth shard ${shardIndex} [cleanup]: removed ${tokensDeleted} refresh token(s), ${sessionsDeleted} session(s)`, {
            shardIndex,
            tokensDeleted,
            sessionsDeleted,
        })
    }
};

run()
    .catch((error) => {
        Logger.fatal(
            'Auth database cleanup job failed', {
            stack: error instanceof Error ? error.stack : undefined,
            message: error instanceof Error ? error.message : String(error),
            errorCode: error instanceof CustomError ? error.errorCode : 500,
            isOperational: error instanceof CustomError ? error.isOperational : false,
        })
        process.exitCode = 1;
    })
    .finally(closeAuthDatabaseConnections);