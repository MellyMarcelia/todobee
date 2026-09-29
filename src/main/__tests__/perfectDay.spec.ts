// Automatic checks for the "good job" stamp rule (perfectDay.ts): a
// post-it earns it only when it has tasks and every one is done. Run them
// with "npm test".
//
// These tests never touch your real saved data. Each one uses a fresh,
// throwaway database that only exists in memory while the test runs.
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../schema'
import { recalculatePerfectDay } from '../perfectDay'

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

// Quickly adds a task (done or not), and gives back its id number.
function insertTask(
  db: Database.Database,
  noteId: number,
  title: string,
  status: 'open' | 'done'
): number {
  return db
    .prepare('INSERT INTO tasks (note_id, title, status) VALUES (?, ?, ?)')
    .run(noteId, title, status).lastInsertRowid as number
}

// Reads straight from the database whether a post-it has the stamp saved.
function readPerfectDay(db: Database.Database, noteId: number): boolean {
  const row = db.prepare('SELECT perfect_day FROM notes WHERE id = ?').get(noteId) as {
    perfect_day: number
  }
  return row.perfect_day === 1
}

describe('recalculatePerfectDay', () => {
  let db: Database.Database

  // Before every test: start again with a brand-new empty database.
  beforeEach(() => {
    db = makeDb()
  })

  it('marks the note perfect when every task is done', () => {
    const noteId = insertNote(db, '2026-09-28')
    insertTask(db, noteId, 'Task A', 'done')
    insertTask(db, noteId, 'Task B', 'done')

    const result = recalculatePerfectDay(db, noteId)

    expect(result).toBe(true)
    expect(readPerfectDay(db, noteId)).toBe(true)
  })

  it('does not mark the note perfect while any task is still open', () => {
    const noteId = insertNote(db, '2026-09-28')
    insertTask(db, noteId, 'Task A', 'done')
    insertTask(db, noteId, 'Task B', 'open')

    const result = recalculatePerfectDay(db, noteId)

    expect(result).toBe(false)
    expect(readPerfectDay(db, noteId)).toBe(false)
  })

  it('does not mark an empty note (no tasks at all) as perfect', () => {
    const noteId = insertNote(db, '2026-09-28')

    const result = recalculatePerfectDay(db, noteId)

    expect(result).toBe(false)
    expect(readPerfectDay(db, noteId)).toBe(false)
  })

  it('un-marks a previously perfect note once a task is reopened', () => {
    const noteId = insertNote(db, '2026-09-28')
    insertTask(db, noteId, 'Task A', 'done')
    recalculatePerfectDay(db, noteId)
    expect(readPerfectDay(db, noteId)).toBe(true)

    db.prepare('UPDATE tasks SET status = ? WHERE note_id = ?').run('open', noteId)
    const result = recalculatePerfectDay(db, noteId)

    expect(result).toBe(false)
    expect(readPerfectDay(db, noteId)).toBe(false)
  })

  it('un-marks a previously perfect note once a new task is added', () => {
    const noteId = insertNote(db, '2026-09-28')
    insertTask(db, noteId, 'Task A', 'done')
    recalculatePerfectDay(db, noteId)
    expect(readPerfectDay(db, noteId)).toBe(true)

    insertTask(db, noteId, 'Task B', 'open')
    const result = recalculatePerfectDay(db, noteId)

    expect(result).toBe(false)
    expect(readPerfectDay(db, noteId)).toBe(false)
  })

  it('re-marks perfect once the newly added task is also finished', () => {
    const noteId = insertNote(db, '2026-09-28')
    insertTask(db, noteId, 'Task A', 'done')
    recalculatePerfectDay(db, noteId)

    const newTaskId = insertTask(db, noteId, 'Task B', 'open')
    recalculatePerfectDay(db, noteId)
    expect(readPerfectDay(db, noteId)).toBe(false)

    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('done', newTaskId)
    const result = recalculatePerfectDay(db, noteId)

    expect(result).toBe(true)
    expect(readPerfectDay(db, noteId)).toBe(true)
  })

  it('does not affect other notes', () => {
    const noteA = insertNote(db, '2026-09-28')
    const noteB = insertNote(db, '2026-09-29')
    insertTask(db, noteA, 'Task A', 'done')
    insertTask(db, noteB, 'Task B', 'open')

    recalculatePerfectDay(db, noteA)
    recalculatePerfectDay(db, noteB)

    expect(readPerfectDay(db, noteA)).toBe(true)
    expect(readPerfectDay(db, noteB)).toBe(false)
  })
})
