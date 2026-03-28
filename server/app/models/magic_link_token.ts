import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class MagicLinkToken extends BaseModel {
	@column({ isPrimary: true })
	declare id: number

	@column()
	declare email: string

	@column()
	declare token: string

	@column()
	declare code: string

	@column.dateTime()
	declare expiresAt: DateTime

	@column.dateTime({ autoCreate: true })
	declare createdAt: DateTime

	get isExpired(): boolean {
		return this.expiresAt < DateTime.now()
	}
}
