import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('seats', (table) => {
        table.binary('id', 16).primary(); // UUIDv7, stored as BINARY(16) — not 32
        table.string('flight_id', 36).notNullable();
        table.string('seat_no', 8).notNullable();
        table.tinyint('seat_class').notNullable(); // 0=economy, 1=business, 2=first
        table.decimal('price', 10, 2).notNullable(); // never FLOAT for money
        table.boolean('available').notNullable().defaultTo(true);
        table.integer('version').notNullable().defaultTo(0); // optimistic locking
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Hottest lookup pattern: find a specific seat on a specific flight.
        // Also serves as a covering-ish index for availability checks.
        table.unique(['flight_id', 'seat_no']);
        table.index(['flight_id', 'available']); // seat availability scan
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('seats');
}