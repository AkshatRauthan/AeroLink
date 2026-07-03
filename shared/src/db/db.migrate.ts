/**
 * Runs Knex migrations against every shard's PRIMARY only.
 * Replicas inherit schema changes automatically via MySQL replication —
 * never run migrations directly against a replica.
 *
 * Usage: pnpm db:migrate
 */
import { getAllPrimaryPools, closeAllPools } from './pooling.config';

const run = async () => {
    const primaries = getAllPrimaryPools();

    for (let i = 0; i < primaries.length; i++) {
        console.log(`Running migrations on shard ${i} primary...`);
        const [batchNo, log] = await primaries[i].migrate.latest({
            directory: './shared/db/migrations',
        });

        if (log.length === 0) {
            console.log(`  Shard ${i}: already up to date.`);
        } else {
            console.log(`  Shard ${i}: batch ${batchNo} ran ${log.length} migration(s):`);
            log.forEach((file: string) => console.log(`    - ${file}`));
        }
    }

    await closeAllPools();
    console.log('All shards migrated.');
};

run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});