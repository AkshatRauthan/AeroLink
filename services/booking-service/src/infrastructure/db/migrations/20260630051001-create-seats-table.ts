import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('seats', (table) => {
        table.binary('id', 16).primary();
        table.string('flight_id', 36).notNullable();
        table.string('seat_no', 8).notNullable();
        table.tinyint('seat_class').notNullable();
        table.decimal('price', 10, 2).notNullable();
        table.boolean('available').notNullable().defaultTo(true);
        table.integer('version').notNullable().defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.unique(['flight_id', 'seat_no']);
        table.index(['flight_id', 'available']);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('seats');
}
