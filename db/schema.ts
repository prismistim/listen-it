import { sql } from 'drizzle-orm'
import { text, integer, sqliteTable, foreignKey } from 'drizzle-orm/sqlite-core'

export const articles = sqliteTable('articles', {
  article_id: integer('article_id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  created_at: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const notes = sqliteTable('notes', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  user_id: text('user_id').notNull(),
  article_id: integer('article_id', { mode: 'number' }).references(() => articles.article_id),
  note_id: text('note_id').notNull(),
  note_text: text('note_text').notNull(),
  content_url: text('content_url').notNull(),
  created_at: text('created_at'),
})
