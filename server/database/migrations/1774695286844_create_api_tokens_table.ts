import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
	protected tableName = 'api_tokens'

	async up() {
		this.schema.createTable(this.tableName, (table) => {
			table.increments('id')
			table.string('token', 64).notNullable().unique()
			table.integer('user_id').unsigned().notNullable()
				.references('id').inTable('users').onDelete('CASCADE')
			table.string('device_label', 100).nullable()
			table.timestamp('created_at').notNullable()
			table.timestamp('last_used_at').nullable()
		})
	}

	async down() {
		this.schema.dropTable(this.tableName)
	}
}
