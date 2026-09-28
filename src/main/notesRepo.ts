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
  const remove = db.transaction(() => {
    const tasks = db
      .prepare<[number], DeletedTaskRow>(
        'SELECT title, status FROM tasks WHERE note_id = ? ORDER BY created_at ASC, id ASC'
      )
      .all(noteId)
    db.prepare('DELETE FROM tasks WHERE note_id = ?').run(noteId)
    db.prepare('DELETE FROM notes WHERE id = ?').run(noteId)
    return tasks
  })
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
  const move = db.transaction(() => {
    const source = db.prepare<[number], NoteRow>('SELECT * FROM notes WHERE id = ?').get(noteId)
    if (!source) throw new Error(`No post-it found (id ${noteId}).`)

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

    recalculatePerfectDay(db, noteId)
    recalculatePerfectDay(db, targetId)
    return { targetId, movedTitles }
  })

  const { targetId, movedTitles } = move()
  return { target: getNoteById(db, targetId)!, movedTitles }
}
