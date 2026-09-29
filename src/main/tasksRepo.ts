// Everything you can do to a single task: list them, add one, rename it,
// tick it, delete it, or move it to another post-it. Each function talks to
// the database once and hands back the result.
import { getDb } from './db'
import type { Task, NewTask } from '../shared/types'

// A task exactly as the database stores it.
interface TaskRow {
  id: number
  note_id: number
  title: string
  status: string
  created_at: string
}

// Converts a task from the database's format into the format the rest of the app uses.
function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    noteId: row.note_id,
    title: row.title,
    status: row.status === 'done' ? 'done' : 'open',
    createdAt: row.created_at
  }
}

// All the tasks on one post-it, oldest first.
export function listTasksForNote(noteId: number): Task[] {
  const db = getDb()
  const rows = db
    .prepare<[number], TaskRow>(
      'SELECT * FROM tasks WHERE note_id = ? ORDER BY created_at ASC, id ASC'
    )
    .all(noteId)
  return rows.map(toTask)
}

// Finds one task. Gives back nothing (null) if it doesn't exist.
export function getTaskById(taskId: number): Task | null {
  const db = getDb()
  const row = db.prepare<[number], TaskRow>('SELECT * FROM tasks WHERE id = ?').get(taskId)
  return row ? toTask(row) : null
}

// Adds a new task, then reads it back to get the id number and time the database gave it.
export function createTask(noteId: number, input: NewTask): Task {
  const db = getDb()
  // Save the new task on the right post-it. It starts as "open" (not done).
  const result = db
    .prepare('INSERT INTO tasks (note_id, title) VALUES (?, ?)')
    .run(noteId, input.title)

  // Read the full task back, using the id number the database just gave it.
  const created = db
    .prepare<[number], TaskRow>('SELECT * FROM tasks WHERE id = ?')
    .get(result.lastInsertRowid as number)!

  return toTask(created)
}

// Renames a task.
export function updateTaskTitle(taskId: number, title: string): Task {
  const db = getDb()
  db.prepare('UPDATE tasks SET title = ? WHERE id = ?').run(title, taskId)

  // Read it back so the screen gets the task exactly as it's now saved.
  const updated = db.prepare<[number], TaskRow>('SELECT * FROM tasks WHERE id = ?').get(taskId)!
  return toTask(updated)
}

// Ticks a task ("done") or un-ticks it ("open").
export function setTaskStatus(taskId: number, status: 'open' | 'done'): Task {
  const db = getDb()
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, taskId)

  // Read it back so the screen gets the task exactly as it's now saved.
  const updated = db.prepare<[number], TaskRow>('SELECT * FROM tasks WHERE id = ?').get(taskId)!
  return toTask(updated)
}

// Deletes a task for good.
export function deleteTask(taskId: number): void {
  const db = getDb()
  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId)
}

/**
 * Moves a task onto a different post-it and marks it as not done again.
 * Used when you un-tick a finished task on an old, locked post-it and
 * say "yes, move it to today".
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
