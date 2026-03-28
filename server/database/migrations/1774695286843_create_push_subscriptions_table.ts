import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
	protected tableName = 'push_subscriptions'

	async up() {
		this.schema.createTable(this.tableName, (table) => {
			table.increments('id').notNullable()
			table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
			table.text('subscription').notNullable()
			table.string('device_label', 100).nullable()
			table.timestamp('created_at').notNullable()
		})
	}

	async down() {
		this.schema.dropTable(this.tableName)
	}
}
