import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { createHash, randomBytes } from 'node:crypto'
import User from '#models/user'

export default class ApiToken extends BaseModel {
	@column({ isPrimary: true })
	declare id: number

	@column()
	declare token: string

	@column()
	declare userId: number

	@column()
	declare deviceLabel: string | null

	@column.dateTime({ autoCreate: true })
	declare createdAt: DateTime

	@column.dateTime()
	declare lastUsedAt: DateTime | null

	@belongsTo(() => User)
	declare user: BelongsTo<typeof User>

	/**
	 * Generate a new API token for a user.
	 * Returns the plaintext token (shown once) and the saved model.
	 */
	static async generate(userId: number, deviceLabel?: string) {
		const plaintext = randomBytes(64).toString('hex')
		const hash = createHash('sha256').update(plaintext).digest('hex')

		const record = await ApiToken.create({
			token: hash,
			userId,
			deviceLabel: deviceLabel || null,
		})

		return { plaintext, record }
	}

	/**
	 * Verify a plaintext token. Returns the ApiToken record with user
	 * preloaded, or null if invalid.
	 */
	static async verify(plaintext: string) {
		const hash = createHash('sha256').update(plaintext).digest('hex')
		const record = await ApiToken.query()
			.where('token', hash)
			.preload('user')
			.first()

		if (!record) return null

		record.lastUsedAt = DateTime.now()
		await record.save()

		return record
	}
}
