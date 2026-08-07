import path from 'path';
import { closeBookingDatabaseConnections, getAllBookingPrimaryPools } from './booking-db.manager';

/** Runs Booking Service migrations on every primary; replication updates replicas. */
const run = async (): Promise<void> => {
    const directory = path.resolve(__dirname, 'migrations');
    for (const [shardIndex, primary] of getAllBookingPrimaryPools().entries()) {
        const [batch, migrations] = await primary.migrate.latest({
            directory,
            loadExtensions: ['.js', '.ts'],
        });
        console.log(migrations.length
            ? `Booking shard ${shardIndex}: batch ${batch} ran ${migrations.length} migration(s).`
            : `Booking shard ${shardIndex}: already up to date.`);
    }
};

run()
    .catch((error: unknown) => {
        console.error('Booking database migration failed:', error);
        process.exitCode = 1;
    })
    .finally(closeBookingDatabaseConnections);
