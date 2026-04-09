import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
	protected tableName = 'meditations'

	async up() {
		this.schema.createTable(this.tableName, (table) => {
			table.increments('id').notNullable()
			table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
			table.timestamp('started_at').notNullable()
			table.timestamp('ended_at').nullable()
		})
	}

	async down() {
		this.schema.dropTable(this.tableName)
	}
}
