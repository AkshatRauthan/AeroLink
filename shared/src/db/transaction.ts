import type { Knex } from 'knex';

/** Runs service-owned work inside a single database transaction. */
export async function runTransaction<T>(
    db: Knex,
    work: (trx: Knex.Transaction) => Promise<T>,
): Promise<T> {
    return db.transaction(work);
}
