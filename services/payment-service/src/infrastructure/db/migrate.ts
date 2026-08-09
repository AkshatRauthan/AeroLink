import path from 'path';
import { closePaymentDatabaseConnections, getAllPaymentPrimaryPools } from './payment-db.manager';

/** Runs Payment Service migrations on every primary shard. */
const run = async (): Promise<void> => {
    const directory = path.resolve(__dirname, 'migrations');
    for (const [shardIndex, primary] of getAllPaymentPrimaryPools().entries()) {
        const [batch, migrations] = await primary.migrate.latest({
            directory,
            loadExtensions: ['.js', '.ts'],
        });
        console.log(migrations.length
            ? `Payment shard ${shardIndex}: batch ${batch} ran ${migrations.length} migration(s).`
            : `Payment shard ${shardIndex}: already up to date.`);
    }
};

run()
    .catch((error: unknown) => {
        console.error('Payment database migration failed:', error);
        process.exitCode = 1;
    })
    .finally(closePaymentDatabaseConnections);
