// The "new day" step. When you open the app on a new day:
//   - each of yesterday's post-its with unfinished tasks gets a matching
//     post-it today (same name and colour), and those tasks move onto it,
//   - yesterday's post-its are locked, so they become history you can look
//     at but not change,
//   - if today has no post-its at all, a default "today's buzz" is made.
// A post-it where everything was done simply stays in history.
import type Database from 'better-sqlite3'
import type { Note } from '../shared/types'
import { DEFAULT_NOTE_TITLE, DEFAULT_NOTE_COLOUR } from '../shared/types'
import { recalculatePerfectDay } from './perfectDay'

// A post-it exactly as the database stores it.
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

// Converts a post-it from the database's format into the format the rest
// of the app uses (for example, the database stores yes/no as 1/0).
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

// Just a task's name, as the database hands it back.
interface TaskTitleRow {
  title: string
}

/** A task that was carried over, with what's needed to write it in the log. */
export interface MovedTask {
  title: string
  fromDate: string
  noteTitle: string
}

/** Today's post-its after the new-day step, plus the tasks that were carried over. */
export interface RolloverResult {
  notes: Note[]
  movedTasks: MovedTask[]
}

/**
 * Runs the new-day step described at the top of this file.
 *
 * It's safe to run many times a day: once an old post-it is locked, there's
 * nothing left to move, so running again changes nothing.
 *
 * Note: it still runs even if today already has post-its (for example ones
 * you planned ahead). Otherwise yesterday's unfinished tasks could get stuck.
 */
export function runLaunchRollover(db: Database.Database, todayDate: string): RolloverResult {
  // Everything inside here is all-or-nothing: if one step fails, none of
  // the changes are kept, so you never end up with half-moved tasks.
  const rollover = db.transaction((): { notes: NoteRow[]; movedTasks: MovedTask[] } => {
    // Today's post-its should never be locked. If one somehow is (this can
    // happen after testing with a fake date), unlock it.
    db.prepare('UPDATE notes SET sealed = 0 WHERE note_date = ? AND sealed = 1').run(todayDate)

    // Today's post-its that already exist (e.g. ones you made earlier today).
    const todayNotes = db
      .prepare<[string], NoteRow>(
        'SELECT * FROM notes WHERE note_date = ? ORDER BY created_at ASC, id ASC'
      )
      .all(todayDate)

    // Find every post-it from before today that isn't locked yet. Usually
    // that's just yesterday's, but if you skipped opening the app for a few
    // days, older ones get picked up too. Post-its planned for future days
    // are left alone.
    const previousNotes = db
      .prepare<[string], NoteRow>(
        'SELECT * FROM notes WHERE sealed = 0 AND note_date < ? ORDER BY created_at ASC, id ASC'
      )
      .all(todayDate)

    // A running list of every task we carry over, so it can be logged later.
    const movedTasks: MovedTask[] = []

    // Finds today's post-it with this name and colour, or makes one. A new
    // one is placed where the old one was pinned on the board, so it
    // doesn't end up hidden under another post-it.
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

    // For each older post-it: move its unfinished tasks to today, then lock it.
    for (const previous of previousNotes) {
      // The tasks on this old post-it that were never ticked off.
      const unfinished = db
        .prepare<[number, string], TaskTitleRow>(
          'SELECT title FROM tasks WHERE note_id = ? AND status = ?'
        )
        .all(previous.id, 'open')

      if (unfinished.length > 0) {
        // Get (or make) the matching post-it for today.
        const target = ensureTodayNote(
          previous.title,
          previous.colour,
          previous.board_x,
          previous.board_y
        )
        // Remember each one for the log...
        for (const row of unfinished) {
          movedTasks.push({
            title: row.title,
            fromDate: previous.note_date,
            noteTitle: previous.title
          })
        }
        // ...then move them all onto today's post-it in one go.
        db.prepare('UPDATE tasks SET note_id = ? WHERE note_id = ? AND status = ?').run(
          target.id,
          previous.id,
          'open'
        )
        // Today's post-it just got unfinished tasks, so re-check its "good job" stamp.
        recalculatePerfectDay(db, target.id)
      }

      // Lock the old post-it. Only its finished tasks are left on it, so
      // re-check its "good job" stamp too.
      db.prepare('UPDATE notes SET sealed = 1 WHERE id = ?').run(previous.id)
      recalculatePerfectDay(db, previous.id)
    }

    // If today still has no post-its, make the default one.
    if (todayNotes.length === 0) ensureTodayNote(DEFAULT_NOTE_TITLE, DEFAULT_NOTE_COLOUR)

    return { notes: todayNotes, movedTasks }
  })

  // Actually run all the steps above.
  const { notes, movedTasks } = rollover()
  // Load today's post-its again so we hand back their latest state.
  const fresh = notes.map((note) =>
    db.prepare<[number], NoteRow>('SELECT * FROM notes WHERE id = ?').get(note.id)!
  )
  return { notes: fresh.map(toNote), movedTasks }
}
