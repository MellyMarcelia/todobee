// Launch-time rollover: creates today's note if it doesn't exist yet, and
// moves any unfinished tasks from the previous (unsealed) note onto it —
// sealing that previous note as read-only history in the process.
//
// This is a pure function over a better-sqlite3 Database (no Electron
// imports), which is what makes it testable with an in-memory database.
import type Database from 'better-sqlite3'
import type { Note } from '../shared/types'

interface NoteRow {
  id: number
  note_date: string
  sealed: number
  perfect_day: number
  created_at: string
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    noteDate: row.note_date,
    sealed: row.sealed === 1,
    perfectDay: row.perfect_day === 1,
    createdAt: row.created_at
  }
}

/**
 * Ensures today's note exists, rolling over unfinished tasks from the
 * previous note the first time this runs on a new day. Safe to call more
 * than once on the same day — if today's note already exists, it's returned
 * as-is and nothing is moved or sealed again.
 */
export function runLaunchRollover(db: Database.Database, todayDate: string): Note {
  const existingToday = db
    .prepare<[string], NoteRow>('SELECT * FROM notes WHERE note_date = ?')
    .get(todayDate)

  if (existingToday) return toNote(existingToday)

  const rollover = db.transaction((): NoteRow => {
    // The previous note is the most recent unsealed note. In normal use
    // there's at most one unsealed note at a time (today's, until it rolls
    // over), so this also self-heals if rollover was ever skipped for a day.
    // Only notes *before* today count: if the clock ever moves backwards
    // (timezone travel, or restarting after the dev "next day" button), a
    // later-dated note must not have its tasks pulled back and get sealed.
    const previous = db
      .prepare<[string], NoteRow>(
        'SELECT * FROM notes WHERE sealed = 0 AND note_date < ? ORDER BY note_date DESC LIMIT 1'
      )
      .get(todayDate)

    const insertResult = db.prepare('INSERT INTO notes (note_date) VALUES (?)').run(todayDate)
    const todayId = insertResult.lastInsertRowid as number

    if (previous) {
      db.prepare('UPDATE tasks SET note_id = ? WHERE note_id = ? AND status = ?').run(
        todayId,
        previous.id,
        'open'
      )
      db.prepare('UPDATE notes SET sealed = 1 WHERE id = ?').run(previous.id)
    }

    return db.prepare<[number], NoteRow>('SELECT * FROM notes WHERE id = ?').get(todayId)!
  })

  return toNote(rollover())
}
