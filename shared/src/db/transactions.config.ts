import type { Knex } from 'knex';

/**
 * Thin wrapper around Knex transactions so every write path in the app
 * uses the same commit/rollback handling instead of repeating
 * try/catch + trx.rollback() in every repository.
 *
 * Usage:
 *   const result = await runTransaction(getShard(flightId).primary, async (trx) => {
 *     const seat = await trx('seats').where({ ... }).forUpdate().first();
 *     ...
 *     return booking;
 *   });
 */
export async function runTransaction<T>(
    db: Knex,
    work: (trx: Knex.Transaction) => Promise<T>,
): Promise<T> {
    const trx = await db.transaction();
    try {
        const result = await work(trx);
        await trx.commit();
        return result;
    } catch (err) {
        await trx.rollback();
        throw err;
    }
};