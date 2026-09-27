// Repository functions for notes and tasks. Kept as plain functions (no
// classes) — each one does one query and returns plain data, matching the
// Note/Task shapes from src/shared/types.ts.
import { getDb } from './db'
import type { Task, NewTask } from '../shared/types'

interface TaskRow {
  id: number
  note_id: number
  title: string
  status: string
  created_at: string
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

export function listTasksForNote(noteId: number): Task[] {
  const db = getDb()
  const rows = db
    .prepare<[number], TaskRow>(
      'SELECT * FROM tasks WHERE note_id = ? ORDER BY created_at ASC, id ASC'
    )
    .all(noteId)
  return rows.map(toTask)
}

export function getTaskById(taskId: number): Task | null {
  const db = getDb()
  const row = db.prepare<[number], TaskRow>('SELECT * FROM tasks WHERE id = ?').get(taskId)
  return row ? toTask(row) : null
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

/**
 * Moves a task onto a different note and reopens it — used when a user
 * reopens a done task on a past (read-only) note and confirms "move to
 * today's note?". The task keeps its title, only its note_id and status change.
 */
export function moveTaskToNote(taskId: number, targetNoteId: number): Task {
  const db = getDb()
  db.prepare('UPDATE tasks SET note_id = ?, status = ? WHERE id = ?').run(
    targetNoteId,
    'open',
    taskId
  )
  const updated = db.prepare<[number], TaskRow>('SELECT * FROM tasks WHERE id = ?').get(taskId)!
  return toTask(updated)
}
