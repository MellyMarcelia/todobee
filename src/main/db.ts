// Database setup for Todobee's main process. better-sqlite3 is synchronous
// (no async/await needed) which keeps this simple for a TypeScript beginner:
// every call here just runs and returns, no Promises involved.
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

/**
 * Opens (or creates) the app's SQLite file in Electron's userData folder and
 * ensures the schema exists. Safe to call more than once — CREATE TABLE IF
 * NOT EXISTS means re-running this on every launch is a no-op once the
 * tables already exist.
 */
export function getDb(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'todobee.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_date TEXT NOT NULL UNIQUE,
      perfect_day INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL REFERENCES notes(id),
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  return db
}
