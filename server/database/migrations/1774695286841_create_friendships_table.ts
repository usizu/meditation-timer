import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
	protected tableName = 'friendships'

	async up() {
		this.schema.createTable(this.tableName, (table) => {
			table.increments('id').notNullable()
			table.integer('user_a_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
			table.integer('user_b_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
			table.boolean('confirmed').notNullable().defaultTo(false)

			/* Notification toggles — all default to true */
			table.boolean('a_notifies_b').notNullable().defaultTo(true)
			table.boolean('b_notifies_a').notNullable().defaultTo(true)
			table.boolean('a_receives_b').notNullable().defaultTo(true)
			table.boolean('b_receives_a').notNullable().defaultTo(true)

			table.timestamp('created_at').notNullable()
			table.timestamp('updated_at').nullable()

			/* Prevent duplicate friendships */
			table.unique(['user_a_id', 'user_b_id'])
		})
	}

	async down() {
		this.schema.dropTable(this.tableName)
	}
}
