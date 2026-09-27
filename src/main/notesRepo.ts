// Repository functions for looking up notes (as opposed to tasksRepo.ts,
// which is about tasks within a note). Used by the history board — plain
// functions over a plain better-sqlite3 Database, same pattern as the rest
// of main/*Repo.ts, so they're testable without Electron.
//
// Milestone 8b: a calendar date can now have several notes (post-its), not
// just one, so this file works in terms of "notes for a date" (plural)
// rather than "the note for a date" (singular).
import type Database from 'better-sqlite3'
import type { BoardNote, Note } from '../shared/types'

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

function toBoardNote(row: NoteRowWithTaskCount): BoardNote {
  return { ...toNote(row), taskCount: row.task_count }
}

/**
 * Every post-it note that belongs to a given calendar date, oldest-created
 * first, each with its task count — what the board needs to render its pins
 * and "N tasks" labels in one query.
 */
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

/** A single note by id, or null if it doesn't exist. */
export function getNoteById(db: Database.Database, noteId: number): Note | null {
  const row = db.prepare<[number], NoteRow>('SELECT * FROM notes WHERE id = ?').get(noteId)
  return row ? toNote(row) : null
}

/** Creates a new, unsealed post-it on the given date with the chosen title/colour. */
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

/** Renames a post-it — clicking its title on the board/note screen. */
export function updateNoteTitle(db: Database.Database, noteId: number, title: string): Note {
  db.prepare('UPDATE notes SET title = ? WHERE id = ?').run(title, noteId)
  return getNoteById(db, noteId)!
}

/**
 * Saves where the user dragged a note to on the board, so it stays there
 * across restarts. Position is board-relative pixels; the renderer is
 * responsible for deciding what "relative to the board" means.
 */
export function setNotePosition(db: Database.Database, noteId: number, x: number, y: number): void {
  db.prepare('UPDATE notes SET board_x = ?, board_y = ? WHERE id = ?').run(x, y, noteId)
}

interface DeletedTaskRow {
  title: string
  status: string
}

/**
 * Deletes a post-it and every task on it, in one transaction so a failure
 * can't leave orphaned tasks behind. Returns the tasks that were removed
 * (title + status) so the caller can log one task.deleted line per task —
 * deleting a whole post-it must never silently drop tasks from the log.
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
