import path from 'path';
import { CustomError, Logger } from '@aerolink/shared';
import { closeFlightDatabaseConnections, getAllFlightPrimaryPools } from './flight-db.manager';

/** Runs Flight Service migrations on every primary shard. */
const run = async (): Promise<void> => {
    const directory = path.resolve(__dirname, 'migrations');

    const pools = getAllFlightPrimaryPools();
    const primaryPools = pools.entries();

    if (pools.length <= 0) {
        throw new CustomError(
            'No booking primary shards reachable for db migration', 500, true
        );
    }

    for (const [shardIndex, primary] of primaryPools) {
        const [batch, migrations] = await primary.migrate.latest({
            directory,
            loadExtensions: ['.js', '.ts'],
        });
        Logger.info(
            migrations.length ? 
            `Flight shard ${shardIndex}: batch ${batch} ran ${migrations.length} migration(s)` :
            `Flight shard ${shardIndex}: already up to date`, {
            shardIndex,
            migrationsRun: migrations.length
        })
    }
};

run()
    .catch((error) => {
        Logger.fatal(
            'Flight database migration failed', {
            stack: error instanceof Error ? error.stack : undefined,
            message: error instanceof Error ? error.message : String(error),
            errorCode: error instanceof CustomError ? error.errorCode : 500,
            isOperational: error instanceof CustomError ? error.isOperational : false,
        })
        process.exitCode = 1;
    })
    .finally(closeFlightDatabaseConnections);
