import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../schema'
import { getNoteByDate, setNotePosition } from '../notesRepo'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  createSchema(db)
  return db
}

function insertNote(
  db: Database.Database,
  noteDate: string,
  sealed: 0 | 1 = 1
): number {
  const result = db
    .prepare('INSERT INTO notes (note_date, sealed) VALUES (?, ?)')
    .run(noteDate, sealed)
  return result.lastInsertRowid as number
}

describe('getNoteByDate', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('returns the note for that date', () => {
    insertNote(db, '2026-09-28')
    const note = getNoteByDate(db, '2026-09-28')
    expect(note?.noteDate).toBe('2026-09-28')
  })

  it('returns null when no note exists for that date', () => {
    expect(getNoteByDate(db, '2026-09-28')).toBeNull()
  })
})

describe('setNotePosition', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('saves the dragged position and getNoteByDate reflects it', () => {
    const noteId = insertNote(db, '2026-09-28')
    setNotePosition(db, noteId, 120.5, 340)

    const note = getNoteByDate(db, '2026-09-28')
    expect(note?.boardX).toBe(120.5)
    expect(note?.boardY).toBe(340)
  })

  it('defaults to null before any position is saved', () => {
    insertNote(db, '2026-09-28')
    const note = getNoteByDate(db, '2026-09-28')
    expect(note?.boardX).toBeNull()
    expect(note?.boardY).toBeNull()
  })
})
