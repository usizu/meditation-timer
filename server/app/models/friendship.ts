import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class Friendship extends BaseModel {
	@column({ isPrimary: true })
	declare id: number

	@column()
	declare userAId: number

	@column()
	declare userBId: number

	@column()
	declare confirmed: boolean

	@column()
	declare aNotifiesB: boolean

	@column()
	declare bNotifiesA: boolean

	@column()
	declare aReceivesB: boolean

	@column()
	declare bReceivesA: boolean

	@column.dateTime({ autoCreate: true })
	declare createdAt: DateTime

	@column.dateTime({ autoCreate: true, autoUpdate: true })
	declare updatedAt: DateTime | null

	@belongsTo(() => User, { foreignKey: 'userAId' })
	declare userA: BelongsTo<typeof User>

	@belongsTo(() => User, { foreignKey: 'userBId' })
	declare userB: BelongsTo<typeof User>

	/**
	 * Get the friend's user record from the perspective of `userId`.
	 */
	friend(userId: number): 'userA' | 'userB' {
		return this.userAId === userId ? 'userB' : 'userA'
	}

	/**
	 * Return the notification toggles from the perspective of `userId`.
	 */
	togglesFor(userId: number) {
		const iAmA = this.userAId === userId
		return {
			notifyThem: iAmA ? this.aNotifiesB : this.bNotifiesA,
			notifyMe: iAmA ? this.aReceivesB : this.bReceivesA,
		}
	}
}
