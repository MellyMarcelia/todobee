// Database setup for Todobee's main process. better-sqlite3 is synchronous
// (no async/await needed) which keeps this simple for a TypeScript beginner:
// every call here just runs and returns, no Promises involved.
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { createSchema } from './schema'

let db: Database.Database | null = null

/**
 * Opens (or creates) the app's SQLite file in Electron's userData folder and
 * ensures the schema exists. Safe to call more than once — createSchema uses
 * CREATE TABLE IF NOT EXISTS, so re-running this on every launch is a no-op
 * once the tables already exist.
 */
export function getDb(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'todobee.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  createSchema(db)

  return db
}
