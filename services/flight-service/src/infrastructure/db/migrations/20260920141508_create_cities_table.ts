import type { Knex} from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('cities', (table) => {
        table.binary('id', 16).primary();
        table.string('name', 100).notNullable();
        table.string("timezone", 50).notNullable();
        table.string('city_code', 3).notNullable().unique();
        table.string("country_code", 2).notNullable();

        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('cities');
}