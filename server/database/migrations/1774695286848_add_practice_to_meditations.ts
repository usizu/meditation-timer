import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
	protected tableName = 'meditations'

	async up() {
		this.schema.alterTable(this.tableName, (table) => {
			table.string('practice', 90).nullable()
		})
	}

	async down() {
		this.schema.alterTable(this.tableName, (table) => {
			table.dropColumn('practice')
		})
	}
}
