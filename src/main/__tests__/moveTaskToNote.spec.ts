// Automatic checks for "move this old finished task back to today"
// (moveTaskToNote in tasksRepo.ts). Run them with "npm test".
//
// These tests never touch your real saved data. Each one uses a fresh,
// throwaway database that only exists in memory while the test runs.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../schema'

// The throwaway database the current test is using.
let testDb: Database.Database

// tasksRepo.ts normally opens the real database file. This swaps that out
// so it uses our throwaway one instead.
vi.mock('../db', () => ({
  getDb: () => testDb
}))

// Load tasksRepo only after the swap above, so it picks up the throwaway
// database instead of the real one.
const { moveTaskToNote } = await import('../tasksRepo')

// Makes a fresh, empty throwaway database with all the tables set up.
function makeDb(): Database.Database {
  const db = new Database(':memory:')
  createSchema(db)
  return db
}

// Quickly adds a post-it on a given day, and gives back its id number.
function insertNote(db: Database.Database, noteDate: string): number {
  return db.prepare('INSERT INTO notes (note_date) VALUES (?)').run(noteDate)
    .lastInsertRowid as number
}

// Quickly adds a task to a post-it (finished, unless told otherwise), and
// gives back its id number.
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

  // Before every test: start again with a brand-new empty database.
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
