import {sqliteTable, text, integer, primaryKey, index} from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  revision: integer('revision').notNull(),
  data: text('data').notNull(),
});

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  usernameKey: text('username_key').notNull().unique(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const profileResults = sqliteTable('profile_results', {
  profileId: text('profile_id').notNull().references(() => profiles.id),
  matchId: text('match_id').notNull(),
  playedAt: integer('played_at').notNull(),
  won: integer('won').notNull(),
  arenaWins: integer('arena_wins').notNull(),
  data: text('data').notNull(),
}, table => [primaryKey({columns: [table.profileId, table.matchId]}),
  index('idx_profile_results_recent').on(table.profileId, table.playedAt)]);
