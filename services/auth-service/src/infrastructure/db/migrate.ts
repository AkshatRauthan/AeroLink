import path from 'path';
import { closeAuthDatabaseConnections, getAllAuthPrimaryPools } from './auth-db.manager';

/** Runs Auth Service migrations on every primary shard. */
const run = async (): Promise<void> => {
    const directory = path.resolve(__dirname, 'migrations');
    for (const [shardIndex, primary] of getAllAuthPrimaryPools().entries()) {
        const [batch, migrations] = await primary.migrate.latest({
            directory,
            loadExtensions: ['.js', '.ts'],
        });
        console.log(migrations.length
            ? `Auth shard ${shardIndex}: batch ${batch} ran ${migrations.length} migration(s).`
            : `Auth shard ${shardIndex}: already up to date.`);
    }
};

run()
    .catch((error: unknown) => {
        console.error('Auth database migration failed:', error);
        process.exitCode = 1;
    })
    .finally(closeAuthDatabaseConnections);
