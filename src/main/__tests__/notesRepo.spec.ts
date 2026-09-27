import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../schema'
import { listNotesForWeek, getNoteByDate, setNotePosition } from '../notesRepo'

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

describe('listNotesForWeek', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('returns only notes within the given Monday-to-Sunday range', () => {
    insertNote(db, '2026-09-27') // Sunday, previous week
    insertNote(db, '2026-09-28') // Monday, in range
    insertNote(db, '2026-10-01') // Thursday, in range
    insertNote(db, '2026-10-04') // Sunday, in range
    insertNote(db, '2026-10-05') // Monday, next week

    const notes = listNotesForWeek(db, '2026-09-28', '2026-10-04')

    expect(notes.map((n) => n.noteDate)).toEqual(['2026-10-04', '2026-10-01', '2026-09-28'])
  })

  it('orders notes newest first', () => {
    insertNote(db, '2026-09-28')
    insertNote(db, '2026-09-30')
    insertNote(db, '2026-09-29')

    const notes = listNotesForWeek(db, '2026-09-28', '2026-10-04')

    expect(notes.map((n) => n.noteDate)).toEqual(['2026-09-30', '2026-09-29', '2026-09-28'])
  })

  it('returns an empty array when no notes exist in that week', () => {
    insertNote(db, '2026-09-20')
    expect(listNotesForWeek(db, '2026-09-28', '2026-10-04')).toEqual([])
  })
})

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
