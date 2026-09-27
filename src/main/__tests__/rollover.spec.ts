import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../schema'
import { runLaunchRollover } from '../rollover'
import { DEFAULT_NOTE_TITLE, DEFAULT_NOTE_COLOUR } from '../../shared/types'

// Seam under test: runLaunchRollover(db, todayDate) — a pure function over a
// better-sqlite3 Database, so these tests run against a real in-memory
// database instead of mocking SQL. No Electron involved.

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  createSchema(db)
  return db
}

function insertNote(
  db: Database.Database,
  noteDate: string,
  title = DEFAULT_NOTE_TITLE,
  colour = DEFAULT_NOTE_COLOUR,
  sealed: 0 | 1 = 0
): number {
  return db
    .prepare('INSERT INTO notes (note_date, title, colour, sealed) VALUES (?, ?, ?, ?)')
    .run(noteDate, title, colour, sealed).lastInsertRowid as number
}

function insertTask(
  db: Database.Database,
  noteId: number,
  title: string,
  status: 'open' | 'done' = 'open'
): void {
  db.prepare('INSERT INTO tasks (note_id, title, status) VALUES (?, ?, ?)').run(
    noteId,
    title,
    status
  )
}

function tasksOnNote(db: Database.Database, noteId: number): { title: string; status: string }[] {
  return db
    .prepare('SELECT title, status FROM tasks WHERE note_id = ? ORDER BY id ASC')
    .all(noteId) as { title: string; status: string }[]
}

function notesForDate(db: Database.Database, noteDate: string): { id: number; title: string }[] {
  return db
    .prepare('SELECT id, title FROM notes WHERE note_date = ? ORDER BY id ASC')
    .all(noteDate) as { id: number; title: string }[]
}

describe('runLaunchRollover', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('creates a fresh default post-it on the very first launch ever', () => {
    const today = runLaunchRollover(db, '2026-09-28')

    expect(today.notes).toHaveLength(1)
    expect(today.notes[0].title).toBe(DEFAULT_NOTE_TITLE)
    expect(today.notes[0].sealed).toBe(false)
  })

  it('does nothing (and creates no notes) on a same-day relaunch when notes already exist', () => {
    const firstLaunch = runLaunchRollover(db, '2026-09-28')
    const secondLaunch = runLaunchRollover(db, '2026-09-28')

    expect(secondLaunch.notes.map((n) => n.id)).toEqual(firstLaunch.notes.map((n) => n.id))
    expect(notesForDate(db, '2026-09-28')).toHaveLength(1)
  })

  it('moves unfinished tasks onto a same-title-and-colour post-it on the new day', () => {
    const yesterday = runLaunchRollover(db, '2026-09-27')
    const yesterdayNote = yesterday.notes[0]
    insertTask(db, yesterdayNote.id, 'Unfinished task', 'open')

    const today = runLaunchRollover(db, '2026-09-28')

    expect(today.notes).toHaveLength(1)
    expect(today.notes[0].title).toBe(DEFAULT_NOTE_TITLE)
    expect(tasksOnNote(db, today.notes[0].id)).toEqual([
      { title: 'Unfinished task', status: 'open' }
    ])
  })

  it('creates a new post-it on today matching each of yesterday\'s post-its that had unfinished tasks', () => {
    const yesterday = runLaunchRollover(db, '2026-09-27')
    const defaultNote = yesterday.notes[0]
    const schoolNote = insertNote(db, '2026-09-27', 'School', '#4A90D9')
    insertTask(db, defaultNote.id, 'Default task', 'open')
    insertTask(db, schoolNote, 'School task', 'open')

    const today = runLaunchRollover(db, '2026-09-28')

    expect(today.notes.map((n) => n.title).sort()).toEqual(['School', DEFAULT_NOTE_TITLE])
    const school = today.notes.find((n) => n.title === 'School')!
    expect(school.colour).toBe('#4A90D9')
    expect(tasksOnNote(db, school.id)).toEqual([{ title: 'School task', status: 'open' }])
  })

  it('does not recreate a post-it that had no unfinished tasks', () => {
    const yesterday = runLaunchRollover(db, '2026-09-27')
    const defaultNote = yesterday.notes[0]
    const schoolNote = insertNote(db, '2026-09-27', 'School', '#4A90D9')
    insertTask(db, defaultNote.id, 'Default task', 'open')
    insertTask(db, schoolNote, 'Finished school task', 'done')

    const today = runLaunchRollover(db, '2026-09-28')

    expect(today.notes.map((n) => n.title)).toEqual([DEFAULT_NOTE_TITLE])
  })

  it('leaves finished tasks on the old post-it instead of moving them', () => {
    const yesterday = runLaunchRollover(db, '2026-09-27')
    const yesterdayNote = yesterday.notes[0]
    insertTask(db, yesterdayNote.id, 'Finished task', 'done')
    insertTask(db, yesterdayNote.id, 'Unfinished task', 'open')

    const today = runLaunchRollover(db, '2026-09-28')

    expect(tasksOnNote(db, yesterdayNote.id)).toEqual([{ title: 'Finished task', status: 'done' }])
    expect(tasksOnNote(db, today.notes[0].id)).toEqual([
      { title: 'Unfinished task', status: 'open' }
    ])
  })

  it('seals every one of the previous day\'s post-its', () => {
    const yesterday = runLaunchRollover(db, '2026-09-27')
    const schoolNote = insertNote(db, '2026-09-27', 'School', '#4A90D9')

    runLaunchRollover(db, '2026-09-28')

    const sealedDefault = db
      .prepare('SELECT sealed FROM notes WHERE id = ?')
      .get(yesterday.notes[0].id) as { sealed: number }
    const sealedSchool = db.prepare('SELECT sealed FROM notes WHERE id = ?').get(schoolNote) as {
      sealed: number
    }
    expect(sealedDefault.sealed).toBe(1)
    expect(sealedSchool.sealed).toBe(1)
  })

  it('does not create a duplicate post-it or roll over again when launched twice on the same day', () => {
    const yesterday = runLaunchRollover(db, '2026-09-27')
    insertTask(db, yesterday.notes[0].id, 'Task A', 'open')

    const firstLaunch = runLaunchRollover(db, '2026-09-28')
    const secondLaunch = runLaunchRollover(db, '2026-09-28')

    expect(secondLaunch.notes.map((n) => n.id)).toEqual(firstLaunch.notes.map((n) => n.id))
    expect(notesForDate(db, '2026-09-28')).toHaveLength(1)
    expect(tasksOnNote(db, firstLaunch.notes[0].id)).toEqual([{ title: 'Task A', status: 'open' }])
  })

  it('does not pull tasks back from a later day\'s notes when the clock moves backwards', () => {
    const later = runLaunchRollover(db, '2026-09-28')
    insertTask(db, later.notes[0].id, 'Future task', 'open')

    const earlier = runLaunchRollover(db, '2026-09-27')

    expect(tasksOnNote(db, earlier.notes[0].id)).toEqual([])
    expect(tasksOnNote(db, later.notes[0].id)).toEqual([{ title: 'Future task', status: 'open' }])
    const reloaded = db.prepare('SELECT sealed FROM notes WHERE id = ?').get(later.notes[0].id) as {
      sealed: number
    }
    expect(reloaded.sealed).toBe(0)
  })

  it('reports which tasks moved, from which note title and date, for logging', () => {
    const yesterday = runLaunchRollover(db, '2026-09-27')
    const yesterdayNote = yesterday.notes[0]
    insertTask(db, yesterdayNote.id, 'Finished task', 'done')
    insertTask(db, yesterdayNote.id, 'Unfinished task', 'open')

    const today = runLaunchRollover(db, '2026-09-28')

    expect(today.movedTasks).toEqual([
      { title: 'Unfinished task', fromDate: '2026-09-27', noteTitle: DEFAULT_NOTE_TITLE }
    ])
  })

  it('reports no moved tasks on the very first launch ever, or on a same-day relaunch', () => {
    const first = runLaunchRollover(db, '2026-09-28')
    expect(first.movedTasks).toEqual([])

    const relaunch = runLaunchRollover(db, '2026-09-28')
    expect(relaunch.movedTasks).toEqual([])
  })
})
