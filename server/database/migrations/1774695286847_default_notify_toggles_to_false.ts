import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
	protected tableName = 'friendships'

	async up() {
		this.schema.alterTable(this.tableName, (table) => {
			table.boolean('a_notifies_b').notNullable().defaultTo(false).alter()
			table.boolean('b_notifies_a').notNullable().defaultTo(false).alter()
			table.boolean('a_receives_b').notNullable().defaultTo(false).alter()
			table.boolean('b_receives_a').notNullable().defaultTo(false).alter()
		})
	}

	async down() {
		this.schema.alterTable(this.tableName, (table) => {
			table.boolean('a_notifies_b').notNullable().defaultTo(true).alter()
			table.boolean('b_notifies_a').notNullable().defaultTo(true).alter()
			table.boolean('a_receives_b').notNullable().defaultTo(true).alter()
			table.boolean('b_receives_a').notNullable().defaultTo(true).alter()
		})
	}
}
