// Describes how the database is laid out - think of it as three
// spreadsheets: one for post-its ("notes"), one for tasks, and one for
// settings. It also upgrades database files made by older versions of the
// app so they match the current layout.
import type Database from 'better-sqlite3'

// Runs every time the app opens. It's safe to repeat: anything that's
// already set up is simply left as it is.
export function createSchema(db: Database.Database): void {
  // Create the three tables, but only if they don't exist yet.
  //  - notes: one row per post-it (its day, name, colour, whether it's
  //    locked, whether it got the "good job" stamp, and where it sits on
  //    the board).
  //  - tasks: one row per task, plus which post-it it's on, and whether
  //    it's "open" (to do) or "done". Nothing else is allowed.
  //  - settings: named values, like which Obsidian folder you picked.
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

  // Older database files may be missing some columns that were added
  // later. Check for each one and add it if it isn't there.
  // First get the list of columns the post-its table has right now.
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

  // Older versions only allowed one post-it per day. Now a day can have
  // several, so that old rule has to be removed. The database can't just
  // delete the rule, so instead we:
  //   1. make a fresh copy of the post-its table without the rule,
  //   2. copy all the post-its into it,
  //   3. throw away the old table and give the new one its name.
  // The "every task needs a real post-it" check is paused while this
  // happens, otherwise it would complain when the old table is removed.
  // Look for that old "one per day" rule. If it's not there, there's
  // nothing to do.
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
