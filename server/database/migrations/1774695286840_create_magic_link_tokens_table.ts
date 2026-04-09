import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
	protected tableName = 'magic_link_tokens'

	async up() {
		this.schema.createTable(this.tableName, (table) => {
			table.increments('id').notNullable()
			table.string('email', 254).notNullable()
			table.string('token', 64).notNullable().unique()
			table.string('code', 6).notNullable()
			table.timestamp('expires_at').notNullable()
			table.timestamp('created_at').notNullable()
		})
	}

	async down() {
		this.schema.dropTable(this.tableName)
	}
}
