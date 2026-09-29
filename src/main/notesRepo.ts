// Everything you can do to a whole post-it: list a day's post-its, create
// one, rename it, remember where it was dragged, delete it, or push its
// unfinished tasks to tomorrow. (Single tasks live in tasksRepo.ts.)
import type Database from 'better-sqlite3'
import type { BoardNote, Note } from '../shared/types'
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

// Same as above, plus how many tasks are on the post-it.
interface NoteRowWithTaskCount extends NoteRow {
  task_count: number
}

// Converts a post-it from the database's format into the format the rest
// of the app uses (for example, the database stores yes/no as 1/0).
export function toNote(row: NoteRow): Note {
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

// Same thing, plus the task count the board shows ("3 tasks").
function toBoardNote(row: NoteRowWithTaskCount): BoardNote {
  return { ...toNote(row), taskCount: row.task_count }
}

/** Every post-it on one day, oldest first, each with its number of tasks. */
export function listNotesForDate(db: Database.Database, noteDate: string): BoardNote[] {
  // Grab that day's post-its, and count the tasks on each one at the same
  // time. A post-it with no tasks still shows up (with a count of 0).
  const rows = db
    .prepare<[string], NoteRowWithTaskCount>(
      `SELECT notes.*, COUNT(tasks.id) AS task_count
       FROM notes
       LEFT JOIN tasks ON tasks.note_id = notes.id
       WHERE notes.note_date = ?
       GROUP BY notes.id
       ORDER BY notes.created_at ASC, notes.id ASC`
    )
    .all(noteDate)
  return rows.map(toBoardNote)
}

/** Finds one post-it. Gives back nothing (null) if it doesn't exist. */
export function getNoteById(db: Database.Database, noteId: number): Note | null {
  const row = db.prepare<[number], NoteRow>('SELECT * FROM notes WHERE id = ?').get(noteId)
  return row ? toNote(row) : null
}

/** Makes a new post-it on the given day, with the name and colour you chose. */
export function createNote(
  db: Database.Database,
  noteDate: string,
  title: string,
  colour: string
): Note {
  const result = db
    .prepare('INSERT INTO notes (note_date, title, colour) VALUES (?, ?, ?)')
    .run(noteDate, title, colour)
  // Read the new post-it back, using the id number the database just gave it.
  return getNoteById(db, result.lastInsertRowid as number)!
}

/** Renames a post-it. */
export function updateNoteTitle(db: Database.Database, noteId: number, title: string): Note {
  db.prepare('UPDATE notes SET title = ? WHERE id = ?').run(title, noteId)
  return getNoteById(db, noteId)!
}

/** Remembers where you dragged a post-it on the board, so it stays there next time. */
export function setNotePosition(db: Database.Database, noteId: number, x: number, y: number): void {
  db.prepare('UPDATE notes SET board_x = ?, board_y = ? WHERE id = ?').run(x, y, noteId)
}

// The bits of a task we need to remember before deleting it (for the log).
interface DeletedTaskRow {
  title: string
  status: string
}

/**
 * Deletes a post-it and all its tasks. It's all-or-nothing: if something
 * goes wrong halfway, nothing is deleted. Gives back the deleted tasks so
 * each one can be written in the log.
 */
export function deleteNote(
  db: Database.Database,
  noteId: number
): { title: string; status: 'open' | 'done' }[] {
  // "transaction" is what makes it all-or-nothing.
  const remove = db.transaction(() => {
    // 1. Note down the tasks first, so we can still log them afterwards.
    const tasks = db
      .prepare<[number], DeletedTaskRow>(
        'SELECT title, status FROM tasks WHERE note_id = ? ORDER BY created_at ASC, id ASC'
      )
      .all(noteId)
    // 2. Delete the tasks, then 3. the post-it itself. (Tasks go first,
    //    because a task isn't allowed to point at a post-it that's gone.)
    db.prepare('DELETE FROM tasks WHERE note_id = ?').run(noteId)
    db.prepare('DELETE FROM notes WHERE id = ?').run(noteId)
    return tasks
  })
  // Run it, and tidy up each task's status so it's always "open" or "done".
  return remove().map((task) => ({
    title: task.title,
    status: task.status === 'done' ? ('done' as const) : ('open' as const)
  }))
}

/**
 * The "move this to the next day" button. Moves a post-it's unfinished
 * tasks onto the post-it with the same name and colour on another day. If
 * that day doesn't have one yet, it's created in the same spot on the board.
 *
 * The original post-it is NOT locked - its day isn't over yet, so you can
 * keep using it.
 *
 * Gives back the post-it the tasks went to, and the names of the moved tasks.
 */
export function moveOpenTasksToDate(
  db: Database.Database,
  noteId: number,
  targetDate: string
): { target: Note; movedTitles: string[] } {
  // All-or-nothing again: either every step below works, or nothing changes.
  const move = db.transaction(() => {
    // The post-it we're moving tasks away from.
    const source = db.prepare<[number], NoteRow>('SELECT * FROM notes WHERE id = ?').get(noteId)
    if (!source) throw new Error(`No post-it found (id ${noteId}).`)

    // Is there already a matching post-it (same name and colour) on the
    // target day? Use it. If not, make one in the same spot on the board.
    const existing = db
      .prepare<[string, string, string], NoteRow>(
        'SELECT * FROM notes WHERE note_date = ? AND title = ? AND colour = ? ORDER BY id ASC'
      )
      .get(targetDate, source.title, source.colour)
    const targetId =
      existing?.id ??
      (db
        .prepare(
          'INSERT INTO notes (note_date, title, colour, board_x, board_y) VALUES (?, ?, ?, ?, ?)'
        )
        .run(targetDate, source.title, source.colour, source.board_x, source.board_y)
        .lastInsertRowid as number)

    // Note down the names of the unfinished tasks (for the log), then move
    // them all over in one go.
    const movedTitles = db
      .prepare<[number], { title: string }>(
        "SELECT title FROM tasks WHERE note_id = ? AND status = 'open' ORDER BY created_at ASC, id ASC"
      )
      .all(noteId)
      .map((row) => row.title)
    db.prepare("UPDATE tasks SET note_id = ? WHERE note_id = ? AND status = 'open'").run(
      targetId,
      noteId
    )

    // Both post-its just changed, so re-check the "good job" stamp on each.
    recalculatePerfectDay(db, noteId)
    recalculatePerfectDay(db, targetId)
    return { targetId, movedTitles }
  })

  // Do it all, then hand back the target post-it in its latest state.
  const { targetId, movedTitles } = move()
  return { target: getNoteById(db, targetId)!, movedTitles }
}
