import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('bookings', (table) => {
        table.binary('id', 16).primary();
        table.string('flight_id', 36).notNullable();
        table.binary('user_id', 16).notNullable();
        table.binary('seat_id', 16).notNullable();
        table.enum('status', ['PENDING', 'PAYMENT_PROCESSING', 'CONFIRMED', 'FAILED', 'EXPIRED', 'CANCELLED'])
            .notNullable()
            .defaultTo('PENDING');
        table.decimal('total_amount', 10, 2).notNullable();
        table.timestamp('expires_at').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.index(['flight_id', 'status']);
        // Seat availability is protected by locking the seat row. Do not make
        // this unique: a cancelled seat can be booked again later.
        table.index(['seat_id']);
    });

    await knex.schema.createTable('idempotency_keys', (table) => {
        table.string('key', 255).notNullable();
        table.binary('user_id', 16).notNullable();
        table.binary('booking_id', 16).nullable();
        table.enum('status', ['PROCESSING', 'COMPLETED', 'FAILED']).notNullable();
        table.json('response_body').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.unique(['user_id', 'key']);
        table.index(['user_id', 'created_at']);
    });

    await knex.schema.createTable('booking_outbox', (table) => {
        table.binary('id', 16).primary();
        table.string('event_type', 100).notNullable();
        table.string('aggregate_id', 36).notNullable();
        table.json('payload').notNullable();
        table.timestamp('occurred_at').defaultTo(knex.fn.now());
        table.timestamp('published_at').nullable();
        table.integer('publish_attempts').notNullable().defaultTo(0);
        table.string('last_error', 1024).nullable();
        table.index(['published_at', 'occurred_at']);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('booking_outbox');
    await knex.schema.dropTableIfExists('idempotency_keys');
    await knex.schema.dropTableIfExists('bookings');
}
