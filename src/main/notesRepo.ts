// Repository functions for looking up notes (as opposed to tasksRepo.ts,
// which is about tasks within a note). Used by the history board — plain
// functions over a plain better-sqlite3 Database, same pattern as the rest
// of main/*Repo.ts, so they're testable without Electron.
import type Database from 'better-sqlite3'
import type { Note } from '../shared/types'

interface NoteRow {
  id: number
  note_date: string
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
    sealed: row.sealed === 1,
    perfectDay: row.perfect_day === 1,
    boardX: row.board_x,
    boardY: row.board_y,
    createdAt: row.created_at
  }
}

/** The note for a specific calendar date, or null if none exists yet. */
export function getNoteByDate(db: Database.Database, noteDate: string): Note | null {
  const row = db
    .prepare<[string], NoteRow>('SELECT * FROM notes WHERE note_date = ?')
    .get(noteDate)
  return row ? toNote(row) : null
}

/**
 * Saves where the user dragged a note to on the board, so it stays there
 * across restarts. Position is board-relative pixels; the renderer is
 * responsible for deciding what "relative to the board" means.
 */
export function setNotePosition(db: Database.Database, noteId: number, x: number, y: number): void {
  db.prepare('UPDATE notes SET board_x = ?, board_y = ? WHERE id = ?').run(x, y, noteId)
}
