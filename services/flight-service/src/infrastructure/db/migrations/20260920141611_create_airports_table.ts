import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
     await knex.schema.createTable('airports', (table) => {
         table.binary('id', 16).primary();
         table.binary('city_id', 16).notNullable()
             .references('id').inTable('cities').onDelete('CASCADE');

         table.string('name', 255).notNullable();
         table.string("timezone", 50).notNullable();
         table.string('iata_code', 3).notNullable().unique();
         table.specificType('coordinates', 'POINT NOT NULL SRID 4326');

         table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
         table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

         table.index('coordinates', 'airports_coordinates_spatial_idx', 'SPATIAL');
     });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('airports');
}