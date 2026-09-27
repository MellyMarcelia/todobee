import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSchema } from '../schema'
import { runLaunchRollover } from '../rollover'

// Seam under test: runLaunchRollover(db, todayDate) — a pure function over a
// better-sqlite3 Database, so these tests run against a real in-memory
// database instead of mocking SQL. No Electron involved.

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  createSchema(db)
  return db
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

describe('runLaunchRollover', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('creates a fresh, unsealed note on the very first launch ever', () => {
    const today = runLaunchRollover(db, '2026-09-28')

    expect(today.noteDate).toBe('2026-09-28')
    expect(today.sealed).toBe(false)
  })

  it('moves unfinished tasks from the previous note onto the new one', () => {
    const yesterday = runLaunchRollover(db, '2026-09-27')
    insertTask(db, yesterday.id, 'Unfinished task', 'open')

    const today = runLaunchRollover(db, '2026-09-28')

    expect(tasksOnNote(db, today.id)).toEqual([{ title: 'Unfinished task', status: 'open' }])
  })

  it('leaves finished tasks on the old note instead of moving them', () => {
    const yesterday = runLaunchRollover(db, '2026-09-27')
    insertTask(db, yesterday.id, 'Finished task', 'done')
    insertTask(db, yesterday.id, 'Unfinished task', 'open')

    const today = runLaunchRollover(db, '2026-09-28')

    expect(tasksOnNote(db, yesterday.id)).toEqual([{ title: 'Finished task', status: 'done' }])
    expect(tasksOnNote(db, today.id)).toEqual([{ title: 'Unfinished task', status: 'open' }])
  })

  it('seals the previous note once its unfinished tasks have rolled over', () => {
    const yesterday = runLaunchRollover(db, '2026-09-27')

    runLaunchRollover(db, '2026-09-28')

    const reloaded = db.prepare('SELECT sealed FROM notes WHERE id = ?').get(yesterday.id) as {
      sealed: number
    }
    expect(reloaded.sealed).toBe(1)
  })

  it('does not create a duplicate note or roll over again when launched twice on the same day', () => {
    const yesterday = runLaunchRollover(db, '2026-09-27')
    insertTask(db, yesterday.id, 'Task A', 'open')

    const firstLaunch = runLaunchRollover(db, '2026-09-28')
    const secondLaunch = runLaunchRollover(db, '2026-09-28')

    expect(secondLaunch.id).toBe(firstLaunch.id)

    const noteCount = db
      .prepare('SELECT COUNT(*) as count FROM notes WHERE note_date = ?')
      .get('2026-09-28') as { count: number }
    expect(noteCount.count).toBe(1)

    // Task A should still appear exactly once — not duplicated by a second rollover.
    expect(tasksOnNote(db, firstLaunch.id)).toEqual([{ title: 'Task A', status: 'open' }])
  })

  it('does not pull tasks back from a later note when the clock moves backwards', () => {
    const later = runLaunchRollover(db, '2026-09-28')
    insertTask(db, later.id, 'Future task', 'open')

    const earlier = runLaunchRollover(db, '2026-09-27')

    expect(tasksOnNote(db, earlier.id)).toEqual([])
    expect(tasksOnNote(db, later.id)).toEqual([{ title: 'Future task', status: 'open' }])
    const reloaded = db.prepare('SELECT sealed FROM notes WHERE id = ?').get(later.id) as {
      sealed: number
    }
    expect(reloaded.sealed).toBe(0)
  })

  it('reports which tasks moved and from which note date, for logging', () => {
    const yesterday = runLaunchRollover(db, '2026-09-27')
    insertTask(db, yesterday.id, 'Finished task', 'done')
    insertTask(db, yesterday.id, 'Unfinished task', 'open')

    const today = runLaunchRollover(db, '2026-09-28')

    expect(today.movedTasks).toEqual([{ title: 'Unfinished task', fromDate: '2026-09-27' }])
  })

  it('reports no moved tasks on the very first launch ever, or on a same-day relaunch', () => {
    const first = runLaunchRollover(db, '2026-09-28')
    expect(first.movedTasks).toEqual([])

    const relaunch = runLaunchRollover(db, '2026-09-28')
    expect(relaunch.movedTasks).toEqual([])
  })
})
