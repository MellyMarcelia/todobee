// Repository functions for notes and tasks. Kept as plain functions (no
// classes) — each one does one query and returns plain data, matching the
// Note/Task shapes from src/shared/types.ts.
import { getDb } from './db'
import type { Note, Task, NewTask } from '../shared/types'

interface NoteRow {
  id: number
  note_date: string
  perfect_day: number
  created_at: string
}

interface TaskRow {
  id: number
  note_id: number
  title: string
  status: string
  created_at: string
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    noteDate: row.note_date,
    perfectDay: row.perfect_day === 1,
    createdAt: row.created_at
  }
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    noteId: row.note_id,
    title: row.title,
    status: row.status === 'done' ? 'done' : 'open',
    createdAt: row.created_at
  }
}

/**
 * Returns today's note, creating it if this is the first time today is seen.
 * Milestone 4 will extend this with rollover logic (moving unfinished tasks
 * from the previous note onto the new one) — for now it only creates an
 * empty note.
 */
export function getOrCreateTodayNote(todayDate: string): Note {
  const db = getDb()

  const existing = db
    .prepare<[string], NoteRow>('SELECT * FROM notes WHERE note_date = ?')
    .get(todayDate)

  if (existing) return toNote(existing)

  const result = db
    .prepare('INSERT INTO notes (note_date) VALUES (?)')
    .run(todayDate)

  const created = db
    .prepare<[number], NoteRow>('SELECT * FROM notes WHERE id = ?')
    .get(result.lastInsertRowid as number)!

  return toNote(created)
}

export function listTasksForNote(noteId: number): Task[] {
  const db = getDb()
  const rows = db
    .prepare<[number], TaskRow>('SELECT * FROM tasks WHERE note_id = ? ORDER BY created_at ASC, id ASC')
    .all(noteId)
  return rows.map(toTask)
}

export function createTask(noteId: number, input: NewTask): Task {
  const db = getDb()
  const result = db
    .prepare('INSERT INTO tasks (note_id, title) VALUES (?, ?)')
    .run(noteId, input.title)

  const created = db
    .prepare<[number], TaskRow>('SELECT * FROM tasks WHERE id = ?')
    .get(result.lastInsertRowid as number)!

  return toTask(created)
}

export function updateTaskTitle(taskId: number, title: string): Task {
  const db = getDb()
  db.prepare('UPDATE tasks SET title = ? WHERE id = ?').run(title, taskId)

  const updated = db.prepare<[number], TaskRow>('SELECT * FROM tasks WHERE id = ?').get(taskId)!
  return toTask(updated)
}

export function setTaskStatus(taskId: number, status: 'open' | 'done'): Task {
  const db = getDb()
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, taskId)

  const updated = db.prepare<[number], TaskRow>('SELECT * FROM tasks WHERE id = ?').get(taskId)!
  return toTask(updated)
}

export function deleteTask(taskId: number): void {
  const db = getDb()
  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId)
}
