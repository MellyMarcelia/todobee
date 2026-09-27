// Schema definition, split out from db.ts so it can be applied to a plain
// better-sqlite3 Database (including an in-memory one in tests) without
// touching Electron's app.getPath.
import type Database from 'better-sqlite3'

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_date TEXT NOT NULL UNIQUE,
      sealed INTEGER NOT NULL DEFAULT 0,
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

  // Migration for local dev databases created before `sealed` existed.
  // CREATE TABLE IF NOT EXISTS won't add the column to an already-existing
  // notes table, so add it by hand if it's missing.
  const columns = db.prepare('PRAGMA table_info(notes)').all() as { name: string }[]
  const hasSealed = columns.some((column) => column.name === 'sealed')
  if (!hasSealed) {
    db.exec('ALTER TABLE notes ADD COLUMN sealed INTEGER NOT NULL DEFAULT 0')
  }
}
