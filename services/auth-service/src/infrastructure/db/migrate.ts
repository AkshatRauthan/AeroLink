import path from 'path';
import { Logger, CustomError } from '@aerolink/shared';
import { closeAuthDatabaseConnections, getAllAuthPrimaryPools } from './auth-db.manager';

/** Runs Auth Service migrations on every primary shard. */
const run = async (): Promise<void> => {
    const directory = path.resolve(__dirname, 'migrations');

    const pools = getAllAuthPrimaryPools();
    const primaryPools = pools.entries();

    if (pools.length <= 0) {
        throw new CustomError(
            'No auth primary sharding reachable for db migration', 500, true
        );
    }

    for (const [shardIndex, primary] of primaryPools) {
        const [batch, migrations] = await primary.migrate.latest({
            directory,
            loadExtensions: ['.js', '.ts'],
        });
        Logger.info(
            migrations.length ? 
            `Auth shard ${shardIndex}: batch ${batch} ran ${migrations.length} migration(s)` :
            `Auth shard ${shardIndex}: already up to date`, {
            shardIndex,
            migrationsRun: migrations.length
        })
    }
};

run()
    .catch((error) => {
        Logger.fatal(
            'Auth database migration failed', {
            stack: error instanceof Error ? error.stack : undefined,
            message: error instanceof Error ? error.message : String(error),
            errorCode: error instanceof CustomError ? error.errorCode : 500,
            isOperational: error instanceof CustomError ? error.isOperational : false,
        })
        process.exitCode = 1;
    })
    .finally(closeAuthDatabaseConnections);
