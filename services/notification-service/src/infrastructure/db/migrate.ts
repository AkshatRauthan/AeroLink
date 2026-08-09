import path from 'path';
import { closeNotificationDatabaseConnections, getAllNotificationPrimaryPools } from './notification-db.manager';

/** Runs Notification Service migrations on every primary shard. */
const run = async (): Promise<void> => {
    const directory = path.resolve(__dirname, 'migrations');
    for (const [shardIndex, primary] of getAllNotificationPrimaryPools().entries()) {
        const [batch, migrations] = await primary.migrate.latest({
            directory,
            loadExtensions: ['.js', '.ts'],
        });
        console.log(migrations.length
            ? `Notification shard ${shardIndex}: batch ${batch} ran ${migrations.length} migration(s).`
            : `Notification shard ${shardIndex}: already up to date.`);
    }
};

run()
    .catch((error: unknown) => {
        console.error('Notification database migration failed:', error);
        process.exitCode = 1;
    })
    .finally(closeNotificationDatabaseConnections);
