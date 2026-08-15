import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('sessions', (table) => {
        table.binary('id', 16).primary();
        table.binary('user_id', 16).notNullable()
            .references('id').inTable('users').onDelete('CASCADE');

        table.string('ip_address', 45).nullable();
        table.string('device_info', 255).nullable();

        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('revoked_at').nullable();
        table.timestamp('last_active_at').notNullable().defaultTo(knex.fn.now());

        table.index('user_id');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('sessions');
}