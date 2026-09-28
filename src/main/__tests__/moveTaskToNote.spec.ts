import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../schema'

let testDb: Database.Database

vi.mock('../db', () => ({
  getDb: () => testDb
}))

// Imported after the mock so tasksRepo's internal getDb() calls resolve to
// our in-memory test database instead of the real Electron userData file.
const { moveTaskToNote } = await import('../tasksRepo')

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  createSchema(db)
  return db
}

function insertNote(db: Database.Database, noteDate: string): number {
  return db.prepare('INSERT INTO notes (note_date) VALUES (?)').run(noteDate)
    .lastInsertRowid as number
}

function insertTask(
  db: Database.Database,
  noteId: number,
  title: string,
  status: 'open' | 'done' = 'done'
): number {
  return db
    .prepare('INSERT INTO tasks (note_id, title, status) VALUES (?, ?, ?)')
    .run(noteId, title, status).lastInsertRowid as number
}

describe('moveTaskToNote', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
    testDb = db
  })

  it('moves the task onto the target note and reopens it', () => {
    const pastNoteId = insertNote(db, '2026-09-20')
    const todayNoteId = insertNote(db, '2026-09-28')
    const taskId = insertTask(db, pastNoteId, 'Old finished task', 'done')

    const moved = moveTaskToNote(taskId, todayNoteId)

    expect(moved.noteId).toBe(todayNoteId)
    expect(moved.status).toBe('open')
    expect(moved.title).toBe('Old finished task')
  })

  it('no longer appears on the original note after moving', () => {
    const pastNoteId = insertNote(db, '2026-09-20')
    const todayNoteId = insertNote(db, '2026-09-28')
    const taskId = insertTask(db, pastNoteId, 'Old finished task', 'done')

    moveTaskToNote(taskId, todayNoteId)

    const remaining = db.prepare('SELECT * FROM tasks WHERE note_id = ?').all(pastNoteId)
    expect(remaining).toEqual([])
  })
})
