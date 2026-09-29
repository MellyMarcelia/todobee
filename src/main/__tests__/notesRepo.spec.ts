// Automatic checks for everything you can do to a whole post-it
// (notesRepo.ts): list, find, create, rename, drag, delete, and "move this
// to the next day". Run them with "npm test".
//
// These tests never touch your real saved data. Each one uses a fresh,
// throwaway database that only exists in memory while the test runs.
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../schema'
import {
  listNotesForDate,
  getNoteById,
  createNote,
  updateNoteTitle,
  setNotePosition,
  deleteNote,
  moveOpenTasksToDate
} from '../notesRepo'
import { runLaunchRollover } from '../rollover'

// Makes a fresh, empty throwaway database with all the tables set up.
function makeDb(): Database.Database {
  const db = new Database(':memory:')
  createSchema(db)
  return db
}

// Quickly adds a post-it (default name and colour unless told otherwise),
// and gives back its id number.
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

// Quickly adds a task called "a task" to a post-it (not done, unless told otherwise).
function insertTask(db: Database.Database, noteId: number, status: 'open' | 'done' = 'open'): void {
  db.prepare('INSERT INTO tasks (note_id, title, status) VALUES (?, ?, ?)').run(
    noteId,
    'a task',
    status
  )
}

// Loading all the post-its for one day, with their task counts.
describe('listNotesForDate', () => {
  let db: Database.Database

  // Before every test: start again with a brand-new empty database.
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

  it("includes each note's task count", () => {
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

// Finding one post-it by its id number.
describe('getNoteById', () => {
  let db: Database.Database

  // Before every test: start again with a brand-new empty database.
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

// Making a new post-it.
describe('createNote', () => {
  let db: Database.Database

  // Before every test: start again with a brand-new empty database.
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

// Renaming a post-it.
describe('updateNoteTitle', () => {
  let db: Database.Database

  // Before every test: start again with a brand-new empty database.
  beforeEach(() => {
    db = makeDb()
  })

  it('renames the note', () => {
    const noteId = insertNote(db, '2026-09-28', 'School', '#4A90D9')
    const updated = updateNoteTitle(db, noteId, 'Uni')
    expect(updated.title).toBe('Uni')
  })
})

// Remembering where a post-it was dragged on the board.
describe('setNotePosition', () => {
  let db: Database.Database

  // Before every test: start again with a brand-new empty database.
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

// Deleting a post-it and its tasks.
describe('deleteNote', () => {
  let db: Database.Database

  // Before every test: start again with a brand-new empty database.
  beforeEach(() => {
    db = makeDb()
  })

  it('removes the note and all of its tasks', () => {
    const noteId = insertNote(db, '2026-09-28', 'School', '#4A90D9')
    insertTask(db, noteId, 'open')
    insertTask(db, noteId, 'done')

    deleteNote(db, noteId)

    expect(getNoteById(db, noteId)).toBeNull()
    const remaining = db
      .prepare('SELECT COUNT(*) AS n FROM tasks WHERE note_id = ?')
      .get(noteId) as {
      n: number
    }
    expect(remaining.n).toBe(0)
  })

  it('returns the deleted tasks so they can be logged', () => {
    const noteId = insertNote(db, '2026-09-28')
    insertTask(db, noteId, 'open')
    insertTask(db, noteId, 'done')

    expect(deleteNote(db, noteId)).toEqual([
      { title: 'a task', status: 'open' },
      { title: 'a task', status: 'done' }
    ])
  })

  it('leaves other notes on the same date untouched', () => {
    const keptId = insertNote(db, '2026-09-28', 'Personal', '#7FB069')
    insertTask(db, keptId)
    const deletedId = insertNote(db, '2026-09-28', 'School', '#4A90D9')

    deleteNote(db, deletedId)

    const notes = listNotesForDate(db, '2026-09-28')
    expect(notes.map((note) => note.id)).toEqual([keptId])
    expect(notes[0].taskCount).toBe(1)
  })
})

// The "move this to the next day" button.
describe('moveOpenTasksToDate', () => {
  let db: Database.Database

  // Lists the tasks (name and done/not done) on a post-it, oldest first.
  function tasksOn(noteId: number): { title: string; status: string }[] {
    return db
      .prepare('SELECT title, status FROM tasks WHERE note_id = ? ORDER BY id ASC')
      .all(noteId) as { title: string; status: string }[]
  }

  // Quickly adds a task with a name and status you choose.
  function insertNamedTask(noteId: number, title: string, status: 'open' | 'done'): void {
    db.prepare('INSERT INTO tasks (note_id, title, status) VALUES (?, ?, ?)').run(
      noteId,
      title,
      status
    )
  }

  // Before every test: start again with a brand-new empty database.
  beforeEach(() => {
    db = makeDb()
  })

  it('moves only the unfinished tasks onto a matching post-it on the target date', () => {
    const today = insertNote(db, '2026-09-28', 'School', '#7FB069')
    insertNamedTask(today, 'Finished', 'done')
    insertNamedTask(today, 'Unfinished', 'open')

    const { target, movedTitles } = moveOpenTasksToDate(db, today, '2026-09-29')

    expect(movedTitles).toEqual(['Unfinished'])
    expect(target.noteDate).toBe('2026-09-29')
    expect(target.title).toBe('School')
    expect(target.colour).toBe('#7FB069')
    expect(tasksOn(target.id)).toEqual([{ title: 'Unfinished', status: 'open' }])
    expect(tasksOn(today)).toEqual([{ title: 'Finished', status: 'done' }])
  })

  it('keeps the source post-it open and editable (not sealed)', () => {
    const today = insertNote(db, '2026-09-28')
    insertNamedTask(today, 'Unfinished', 'open')

    moveOpenTasksToDate(db, today, '2026-09-29')

    expect(getNoteById(db, today)?.sealed).toBe(false)
  })

  it('reuses the matching post-it when moving more tasks later the same day', () => {
    const today = insertNote(db, '2026-09-28')
    insertNamedTask(today, 'First', 'open')
    const first = moveOpenTasksToDate(db, today, '2026-09-29')
    insertNamedTask(today, 'Second', 'open')
    const second = moveOpenTasksToDate(db, today, '2026-09-29')

    expect(second.target.id).toBe(first.target.id)
    expect(listNotesForDate(db, '2026-09-29')).toHaveLength(1)
    expect(tasksOn(first.target.id).map((t) => t.title)).toEqual(['First', 'Second'])
  })

  it('pins the new post-it where the original is on the board', () => {
    const today = insertNote(db, '2026-09-28')
    setNotePosition(db, today, 44, 65)
    insertNamedTask(today, 'Unfinished', 'open')

    const { target } = moveOpenTasksToDate(db, today, '2026-09-29')

    expect(target.boardX).toBe(44)
    expect(target.boardY).toBe(65)
  })

  it('is picked up by rollover when the next day arrives, without duplicating it', () => {
    const today = insertNote(db, '2026-09-28', 'School', '#7FB069')
    insertNamedTask(today, 'Finished', 'done')
    insertNamedTask(today, 'Postponed', 'open')
    const { target } = moveOpenTasksToDate(db, today, '2026-09-29')

    const result = runLaunchRollover(db, '2026-09-29')

    expect(result.notes.map((n) => n.id)).toEqual([target.id])
    expect(tasksOn(target.id)).toEqual([{ title: 'Postponed', status: 'open' }])
    expect(getNoteById(db, today)?.sealed).toBe(true)
  })
})
