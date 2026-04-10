import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class Meditation extends BaseModel {
	@column({ isPrimary: true })
	declare id: number

	@column()
	declare userId: number

	@column.dateTime()
	declare startedAt: DateTime

	@column.dateTime()
	declare endedAt: DateTime | null

	@column()
	declare practice: string | null

	@belongsTo(() => User)
	declare user: BelongsTo<typeof User>

	get isActive(): boolean {
		return this.endedAt === null
	}
}
