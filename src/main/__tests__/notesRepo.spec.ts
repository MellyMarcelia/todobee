import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../schema'
import {
  listNotesForDate,
  getNoteById,
  createNote,
  updateNoteTitle,
  setNotePosition
} from '../notesRepo'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  createSchema(db)
  return db
}

function insertNote(
  db: Database.Database,
  noteDate: string,
  title = "today's buzz",
  colour = '#F6C56A'
): number {
  const result = db
    .prepare('INSERT INTO notes (note_date, title, colour) VALUES (?, ?, ?)')
    .run(noteDate, title, colour)
  return result.lastInsertRowid as number
}

function insertTask(db: Database.Database, noteId: number, status: 'open' | 'done' = 'open'): void {
  db.prepare('INSERT INTO tasks (note_id, title, status) VALUES (?, ?, ?)').run(
    noteId,
    'a task',
    status
  )
}

describe('listNotesForDate', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('returns every post-it note for that date', () => {
    insertNote(db, '2026-09-28', "today's buzz", '#F6C56A')
    insertNote(db, '2026-09-28', 'School', '#4A90D9')
    insertNote(db, '2026-09-29', 'Other day', '#E9A23B')

    const notes = listNotesForDate(db, '2026-09-28')

    expect(notes.map((n) => n.title).sort()).toEqual(['School', "today's buzz"])
  })

  it('returns an empty array when the date has no notes', () => {
    expect(listNotesForDate(db, '2026-09-28')).toEqual([])
  })

  it('includes each note\'s task count', () => {
    const noteId = insertNote(db, '2026-09-28', 'School', '#4A90D9')
    insertTask(db, noteId, 'open')
    insertTask(db, noteId, 'done')
    insertTask(db, noteId, 'open')

    const [note] = listNotesForDate(db, '2026-09-28')

    expect(note.taskCount).toBe(3)
  })

  it('reports a task count of 0 for a note with no tasks', () => {
    insertNote(db, '2026-09-28', 'Empty', '#4A90D9')

    const [note] = listNotesForDate(db, '2026-09-28')

    expect(note.taskCount).toBe(0)
  })

  it('orders notes oldest-created first', () => {
    insertNote(db, '2026-09-28', 'First', '#F6C56A')
    insertNote(db, '2026-09-28', 'Second', '#4A90D9')

    const notes = listNotesForDate(db, '2026-09-28')

    expect(notes.map((n) => n.title)).toEqual(['First', 'Second'])
  })
})

describe('getNoteById', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('returns the note with that id', () => {
    const noteId = insertNote(db, '2026-09-28', 'School', '#4A90D9')
    const note = getNoteById(db, noteId)
    expect(note?.title).toBe('School')
    expect(note?.colour).toBe('#4A90D9')
  })

  it('returns null when no note has that id', () => {
    expect(getNoteById(db, 999)).toBeNull()
  })
})

describe('createNote', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('creates a new unsealed post-it with the given title and colour', () => {
    const note = createNote(db, '2026-09-28', 'Personal', '#7FB069')

    expect(note.noteDate).toBe('2026-09-28')
    expect(note.title).toBe('Personal')
    expect(note.colour).toBe('#7FB069')
    expect(note.sealed).toBe(false)
  })

  it('allows more than one note on the same date', () => {
    createNote(db, '2026-09-28', 'School', '#4A90D9')
    createNote(db, '2026-09-28', 'Personal', '#7FB069')

    expect(listNotesForDate(db, '2026-09-28')).toHaveLength(2)
  })
})

describe('updateNoteTitle', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('renames the note', () => {
    const noteId = insertNote(db, '2026-09-28', 'School', '#4A90D9')
    const updated = updateNoteTitle(db, noteId, 'Uni')
    expect(updated.title).toBe('Uni')
  })
})

describe('setNotePosition', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('saves the dragged position', () => {
    const noteId = insertNote(db, '2026-09-28')
    setNotePosition(db, noteId, 120.5, 340)

    const note = getNoteById(db, noteId)
    expect(note?.boardX).toBe(120.5)
    expect(note?.boardY).toBe(340)
  })

  it('defaults to null before any position is saved', () => {
    const noteId = insertNote(db, '2026-09-28')
    const note = getNoteById(db, noteId)
    expect(note?.boardX).toBeNull()
    expect(note?.boardY).toBeNull()
  })
})
