// Opens the app's database - the file on your computer where all your
// post-its and tasks are saved. The first time the app runs, the file
// doesn't exist yet, so it gets created here.
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { createSchema } from './schema'

// We only ever open the database once and then keep reusing it.
let db: Database.Database | null = null

/**
 * Gives back the open database, opening it first if needed. It also makes
 * sure all the tables exist, which is harmless to repeat on every launch.
 */
export function getDb(): Database.Database {
  if (db) return db

  // The file lives in the app's own private folder on your computer
  // (on a Mac: ~/Library/Application Support/todobee).
  const dbPath = join(app.getPath('userData'), 'todobee.db')
  db = new Database(dbPath)
  // A faster, safer way of saving. If the app crashes mid-save, your data
  // doesn't get scrambled.
  db.pragma('journal_mode = WAL')
  // Makes the database enforce that every task belongs to a post-it that
  // really exists. It's off by default, so we have to switch it on.
  db.pragma('foreign_keys = ON')
  createSchema(db)

  return db
}
