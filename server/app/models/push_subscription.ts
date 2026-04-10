import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class PushSubscription extends BaseModel {
	@column({ isPrimary: true })
	declare id: number

	@column()
	declare userId: number

	@column()
	declare subscription: string

	@column()
	declare type: 'web' | 'apns' | 'fcm'

	@column()
	declare deviceLabel: string | null

	@column.dateTime({ autoCreate: true })
	declare createdAt: DateTime

	@belongsTo(() => User)
	declare user: BelongsTo<typeof User>

	get parsedSubscription() {
		return JSON.parse(this.subscription)
	}
}
