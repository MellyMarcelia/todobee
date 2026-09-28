// Decides whether a post-it has earned the "good job" stamp: it needs at
// least one task, and every task on it must be ticked off. This is
// re-checked every time a task is added, ticked, un-ticked or deleted.
import type Database from 'better-sqlite3'

interface CountRow {
  total: number
  openCount: number
}

/**
 * Counts the post-it's tasks (all of them, and how many are still not
 * done), saves "perfect or not" on the post-it, and gives the answer back.
 */
export function recalculatePerfectDay(db: Database.Database, noteId: number): boolean {
  const counts = db
    .prepare<[number], CountRow>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS openCount
       FROM tasks WHERE note_id = ?`
    )
    .get(noteId)!

  const isPerfect = counts.total > 0 && counts.openCount === 0
  db.prepare('UPDATE notes SET perfect_day = ? WHERE id = ?').run(isPerfect ? 1 : 0, noteId)
  return isPerfect
}
