import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class User extends BaseModel {
	@column({ isPrimary: true })
	declare id: number

	@column()
	declare email: string

	@column()
	declare timezone: string

	@column()
	declare nickname: string | null

	@column()
	declare status: string | null

	@column.dateTime({ autoCreate: true })
	declare createdAt: DateTime

	@column.dateTime({ autoCreate: true, autoUpdate: true })
	declare updatedAt: DateTime | null
}
