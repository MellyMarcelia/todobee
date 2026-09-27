// Launch-time rollover: ensures today has at least the default post-it, and
// moves any unfinished tasks from yesterday's (unsealed) post-its onto
// matching post-its on today — sealing every one of yesterday's post-its as
// read-only history in the process.
//
// Milestone 8b: a day can have several post-its, so this now operates on
// "yesterday's notes" (plural) rather than a single note. Each of
// yesterday's post-its that still has unfinished tasks gets a same-title-
// and-colour post-it created on today (or reused, if today already has a
// matching one) and its unfinished tasks move there. A post-it with nothing
// unfinished on it simply isn't recreated — it stays in history as a sealed
// note, but doesn't carry forward as an active post-it.
//
// This is a pure function over a better-sqlite3 Database (no Electron
// imports), which is what makes it testable with an in-memory database.
import type Database from 'better-sqlite3'
import type { Note } from '../shared/types'
import { DEFAULT_NOTE_TITLE, DEFAULT_NOTE_COLOUR } from '../shared/types'
import { recalculatePerfectDay } from './perfectDay'

interface NoteRow {
  id: number
  note_date: string
  title: string
  colour: string
  sealed: number
  perfect_day: number
  board_x: number | null
  board_y: number | null
  created_at: string
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    noteDate: row.note_date,
    title: row.title,
    colour: row.colour,
    sealed: row.sealed === 1,
    perfectDay: row.perfect_day === 1,
    boardX: row.board_x,
    boardY: row.board_y,
    createdAt: row.created_at
  }
}

interface TaskTitleRow {
  title: string
}

/** One task that moved forward, plus enough context to log it. */
export interface MovedTask {
  title: string
  fromDate: string
  noteTitle: string
}

/** Every post-it that exists for "today" after rollover, plus which tasks (if any) just moved onto them. */
export interface RolloverResult {
  notes: Note[]
  movedTasks: MovedTask[]
}

/**
 * Ensures today has at least its default post-it, rolling over unfinished
 * tasks from yesterday's post-its the first time this runs on a new day.
 * Safe to call more than once on the same day — if today already has any
 * notes, they're returned as-is and nothing is moved or sealed again.
 */
export function runLaunchRollover(db: Database.Database, todayDate: string): RolloverResult {
  const existingToday = db
    .prepare<[string], NoteRow>('SELECT * FROM notes WHERE note_date = ? ORDER BY created_at ASC, id ASC')
    .all(todayDate)

  if (existingToday.length > 0) {
    return { notes: existingToday.map(toNote), movedTasks: [] }
  }

  const rollover = db.transaction((): { notes: NoteRow[]; movedTasks: MovedTask[] } => {
    // Yesterday's post-its are every unsealed note dated before today. In
    // normal use these are exactly the post-its still open from the most
    // recent day rollover ran, so this also self-heals if rollover was ever
    // skipped for a day. Only notes *before* today count: if the clock ever
    // moves backwards (timezone travel, or restarting after the dev "next
    // day" button), a later-dated note must not have its tasks pulled back
    // and get sealed.
    const previousNotes = db
      .prepare<[string], NoteRow>(
        'SELECT * FROM notes WHERE sealed = 0 AND note_date < ? ORDER BY created_at ASC, id ASC'
      )
      .all(todayDate)

    const movedTasks: MovedTask[] = []
    const todayNotes: NoteRow[] = []

    function ensureTodayNote(title: string, colour: string): NoteRow {
      const existing = todayNotes.find((n) => n.title === title && n.colour === colour)
      if (existing) return existing
      const insertResult = db
        .prepare('INSERT INTO notes (note_date, title, colour) VALUES (?, ?, ?)')
        .run(todayDate, title, colour)
      const created = db
        .prepare<[number], NoteRow>('SELECT * FROM notes WHERE id = ?')
        .get(insertResult.lastInsertRowid as number)!
      todayNotes.push(created)
      return created
    }

    for (const previous of previousNotes) {
      const unfinished = db
        .prepare<[number, string], TaskTitleRow>(
          'SELECT title FROM tasks WHERE note_id = ? AND status = ?'
        )
        .all(previous.id, 'open')

      if (unfinished.length > 0) {
        const target = ensureTodayNote(previous.title, previous.colour)
        for (const row of unfinished) {
          movedTasks.push({ title: row.title, fromDate: previous.note_date, noteTitle: previous.title })
        }
        db.prepare('UPDATE tasks SET note_id = ? WHERE note_id = ? AND status = ?').run(
          target.id,
          previous.id,
          'open'
        )
      }

      db.prepare('UPDATE notes SET sealed = 1 WHERE id = ?').run(previous.id)
      // Only remaining tasks on the sealed note are done ones (unfinished
      // ones just moved away), so it's now perfect exactly when it isn't
      // empty — recalculate rather than assume, to stay consistent with
      // every other perfect_day update path.
      recalculatePerfectDay(db, previous.id)
    }

    // Every new day starts with at least the default post-it — create it
    // now if nothing rolled forward into one with that title/colour.
    ensureTodayNote(DEFAULT_NOTE_TITLE, DEFAULT_NOTE_COLOUR)

    return { notes: todayNotes, movedTasks }
  })

  const { notes, movedTasks } = rollover()
  return { notes: notes.map(toNote), movedTasks }
}
