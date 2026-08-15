import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('refresh_tokens', (table) => {
        table.binary('id', 16).primary();
        table.binary('session_id', 16).notNullable()
            .references('id').inTable('sessions').onDelete('CASCADE');

        table.string('token_hash', 255).notNullable().unique();
        table.binary('replaced_by', 16).nullable()
            .references('id').inTable('refresh_tokens').onDelete('SET NULL');

        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('revoked_at').nullable();

        table.index('session_id');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('refresh_tokens');
}