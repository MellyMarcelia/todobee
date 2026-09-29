// Decides whether a post-it has earned the "good job" stamp: it needs at
// least one task, and every task on it must be ticked off. This is
// re-checked every time a task is added, ticked, un-ticked or deleted.
import type Database from 'better-sqlite3'

// The answer we get back from the database: how many tasks in total, and
// how many of those are still not done.
interface CountRow {
  total: number
  openCount: number
}

/**
 * Counts the post-it's tasks (all of them, and how many are still not
 * done), saves "perfect or not" on the post-it, and gives the answer back.
 */
export function recalculatePerfectDay(db: Database.Database, noteId: number): boolean {
  // Ask the database to count this post-it's tasks for us.
  const counts = db
    .prepare<[number], CountRow>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS openCount
       FROM tasks WHERE note_id = ?`
    )
    .get(noteId)!

  // "Perfect" = has at least one task, and none left to do.
  const isPerfect = counts.total > 0 && counts.openCount === 0
  // Save the answer on the post-it (the database writes yes/no as 1/0).
  db.prepare('UPDATE notes SET perfect_day = ? WHERE id = ?').run(isPerfect ? 1 : 0, noteId)
  return isPerfect
}
