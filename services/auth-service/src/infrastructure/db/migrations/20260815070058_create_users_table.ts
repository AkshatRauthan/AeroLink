import type { Knex } from "knex";
import { UserRoleEnums } from "@root/modules/auth";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('users', (table) => {
        table.binary('id', 16).primary();

        table.string('email', 255).notNullable().unique();
        table.string('password', 255).notNullable();

        table.enum('role', Object.values(UserRoleEnums)).notNullable().defaultTo(UserRoleEnums.USER);
        table.timestamp('last_login_at').nullable();
        table.boolean('email_verified').notNullable().defaultTo(false);
        table.boolean('phone_verified').notNullable().defaultTo(false);
        table.boolean('profile_created').notNullable().defaultTo(false);

        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('user_profiles', (table) => {
        table.binary('id', 16).primary()
            .references('id').inTable('users').onDelete('CASCADE');

        table.string('first_name', 100).notNullable();
        table.string('middle_name', 100).nullable();
        table.string('last_name', 100).notNullable();

        table.string('phone_no', 20).notNullable();
        table.string('address', 500).nullable();

        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('user_profiles');
    await knex.schema.dropTableIfExists('users');
}