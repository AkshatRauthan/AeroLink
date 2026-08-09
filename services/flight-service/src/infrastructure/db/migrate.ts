import path from 'path';
import { closeFlightDatabaseConnections, getAllFlightPrimaryPools } from './flight-db.manager';

/** Runs Flight Service migrations on every primary shard. */
const run = async (): Promise<void> => {
    const directory = path.resolve(__dirname, 'migrations');
    for (const [shardIndex, primary] of getAllFlightPrimaryPools().entries()) {
        const [batch, migrations] = await primary.migrate.latest({
            directory,
            loadExtensions: ['.js', '.ts'],
        });
        console.log(migrations.length
            ? `Flight shard ${shardIndex}: batch ${batch} ran ${migrations.length} migration(s).`
            : `Flight shard ${shardIndex}: already up to date.`);
    }
};

run()
    .catch((error: unknown) => {
        console.error('Flight database migration failed:', error);
        process.exitCode = 1;
    })
    .finally(closeFlightDatabaseConnections);
