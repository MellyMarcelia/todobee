// Schema definition, split out from db.ts so it can be applied to a plain
// better-sqlite3 Database (including an in-memory one in tests) without
// touching Electron's app.getPath.
import type Database from 'better-sqlite3'

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_date TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'today''s buzz',
      colour TEXT NOT NULL DEFAULT '#F6C56A',
      sealed INTEGER NOT NULL DEFAULT 0,
      perfect_day INTEGER NOT NULL DEFAULT 0,
      board_x REAL,
      board_y REAL,
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

  // Migrations for local dev databases created before a given column
  // existed. CREATE TABLE IF NOT EXISTS won't add columns to an
  // already-existing table, so add them by hand if missing.
  const columns = db.prepare('PRAGMA table_info(notes)').all() as { name: string }[]
  const hasSealed = columns.some((column) => column.name === 'sealed')
  if (!hasSealed) {
    db.exec('ALTER TABLE notes ADD COLUMN sealed INTEGER NOT NULL DEFAULT 0')
  }
  const hasBoardX = columns.some((column) => column.name === 'board_x')
  if (!hasBoardX) {
    db.exec('ALTER TABLE notes ADD COLUMN board_x REAL')
  }
  const hasBoardY = columns.some((column) => column.name === 'board_y')
  if (!hasBoardY) {
    db.exec('ALTER TABLE notes ADD COLUMN board_y REAL')
  }
  const hasTitle = columns.some((column) => column.name === 'title')
  if (!hasTitle) {
    db.exec("ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT 'today''s buzz'")
  }
  const hasColour = columns.some((column) => column.name === 'colour')
  if (!hasColour) {
    db.exec("ALTER TABLE notes ADD COLUMN colour TEXT NOT NULL DEFAULT '#F6C56A'")
  }

  // Milestone 8b: notes.note_date used to be UNIQUE (one note per day).
  // Multiple post-its per day means that constraint has to go. SQLite has
  // no "DROP CONSTRAINT", so rebuild the table without it, following
  // SQLite's documented pattern for unsupported ALTER TABLE changes:
  // create the replacement table, copy the data across, drop the old
  // table, then rename the replacement into place — with foreign_keys
  // temporarily off so dropping the old "notes" table (still referenced
  // by tasks.note_id) doesn't get rejected mid-migration.
  const indexes = db.prepare('PRAGMA index_list(notes)').all() as {
    name: string
    unique: number
    origin: string
  }[]
  const hasDateUniqueIndex = indexes.some((index) => index.unique === 1 && index.origin === 'u')
  if (hasDateUniqueIndex) {
    const foreignKeysWereOn = (db.pragma('foreign_keys', { simple: true }) as number) === 1
    if (foreignKeysWereOn) db.pragma('foreign_keys = OFF')
    db.exec(`
      CREATE TABLE notes_rebuild (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_date TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'today''s buzz',
        colour TEXT NOT NULL DEFAULT '#F6C56A',
        sealed INTEGER NOT NULL DEFAULT 0,
        perfect_day INTEGER NOT NULL DEFAULT 0,
        board_x REAL,
        board_y REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO notes_rebuild (id, note_date, title, colour, sealed, perfect_day, board_x, board_y, created_at)
        SELECT id, note_date, title, colour, sealed, perfect_day, board_x, board_y, created_at FROM notes;
      DROP TABLE notes;
      ALTER TABLE notes_rebuild RENAME TO notes;
    `)
    if (foreignKeysWereOn) db.pragma('foreign_keys = ON')
  }
}
