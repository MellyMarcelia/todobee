// Launch-time rollover: ensures today has at least the default post-it, and
// moves any unfinished tasks from yesterday's (unsealed) post-its onto
// matching post-its on today - sealing every one of yesterday's post-its as
// read-only history in the process.
//
// Milestone 8b: a day can have several post-its, so this now operates on
// "yesterday's notes" (plural) rather than a single note. Each of
// yesterday's post-its that still has unfinished tasks gets a same-title-
// and-colour post-it created on today (or reused, if today already has a
// matching one) and its unfinished tasks move there. A post-it with nothing
// unfinished on it simply isn't recreated - it stays in history as a sealed
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
 * Ensures today has at least its default post-it, and rolls over unfinished
 * tasks from every earlier post-it that hasn't been sealed yet.
 *
 * Safe to call more than once on the same day: once an earlier post-it has
 * rolled over it's sealed, so a second run finds nothing left to move and
 * leaves today's post-its as they are.
 *
 * This deliberately does *not* skip rollover just because today already has
 * a post-it. That used to be the "already ran today" check, but a day can
 * gain a post-it before rollover has run for it - most commonly when the
 * dev "move to the next day" button has visited a date, the app restarts
 * back on the real date, and later reaches that date again. Skipping there
 * left the earlier day's unfinished tasks stranded and today read-only.
 */
export function runLaunchRollover(db: Database.Database, todayDate: string): RolloverResult {
  const rollover = db.transaction((): { notes: NoteRow[]; movedTasks: MovedTask[] } => {
    // A post-it dated today is never history, so it can't be sealed. One
    // can only be sealed here if the date was visited before and then left
    // (the dev "next day" button, then an app restart), so reopen it.
    db.prepare('UPDATE notes SET sealed = 0 WHERE note_date = ? AND sealed = 1').run(todayDate)

    const todayNotes = db
      .prepare<[string], NoteRow>(
        'SELECT * FROM notes WHERE note_date = ? ORDER BY created_at ASC, id ASC'
      )
      .all(todayDate)

    // Earlier post-its are every unsealed note dated before today. In
    // normal use these are exactly yesterday's post-its, so this also
    // self-heals if rollover was ever skipped for a day. Only notes *before*
    // today count: if the clock ever moves backwards (timezone travel, or
    // restarting after the dev "next day" button), a later-dated note must
    // not have its tasks pulled back and get sealed.
    const previousNotes = db
      .prepare<[string], NoteRow>(
        'SELECT * FROM notes WHERE sealed = 0 AND note_date < ? ORDER BY created_at ASC, id ASC'
      )
      .all(todayDate)

    const movedTasks: MovedTask[] = []

    // A post-it created to continue an earlier one starts where that one was
    // pinned on the board, so it doesn't land in a default spot hidden under
    // another post-it.
    function ensureTodayNote(
      title: string,
      colour: string,
      boardX: number | null = null,
      boardY: number | null = null
    ): NoteRow {
      const existing = todayNotes.find((n) => n.title === title && n.colour === colour)
      if (existing) return existing
      const insertResult = db
        .prepare(
          'INSERT INTO notes (note_date, title, colour, board_x, board_y) VALUES (?, ?, ?, ?, ?)'
        )
        .run(todayDate, title, colour, boardX, boardY)
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
        const target = ensureTodayNote(
          previous.title,
          previous.colour,
          previous.board_x,
          previous.board_y
        )
        for (const row of unfinished) {
          movedTasks.push({
            title: row.title,
            fromDate: previous.note_date,
            noteTitle: previous.title
          })
        }
        db.prepare('UPDATE tasks SET note_id = ? WHERE note_id = ? AND status = ?').run(
          target.id,
          previous.id,
          'open'
        )
        // The target just gained open tasks, so it can't be "perfect" any more.
        recalculatePerfectDay(db, target.id)
      }

      db.prepare('UPDATE notes SET sealed = 1 WHERE id = ?').run(previous.id)
      // Only remaining tasks on the sealed note are done ones (unfinished
      // ones just moved away), so it's now perfect exactly when it isn't
      // empty - recalculate rather than assume, to stay consistent with
      // every other perfect_day update path.
      recalculatePerfectDay(db, previous.id)
    }

    // Every day starts with at least the default post-it - create it now if
    // today has no post-its at all (nothing existed and nothing rolled in).
    if (todayNotes.length === 0) ensureTodayNote(DEFAULT_NOTE_TITLE, DEFAULT_NOTE_COLOUR)

    return { notes: todayNotes, movedTasks }
  })

  const { notes, movedTasks } = rollover()
  // Re-read so sealed/perfect_day reflect the updates made above.
  const fresh = notes.map((note) =>
    db.prepare<[number], NoteRow>('SELECT * FROM notes WHERE id = ?').get(note.id)!
  )
  return { notes: fresh.map(toNote), movedTasks }
}
