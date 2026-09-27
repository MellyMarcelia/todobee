// Derives and stores the "perfect day" flag on a note — true only when the
// note has at least one task and every one of them is done. Called after
// any task change (create/edit/complete/reopen/delete) on that note, so
// perfect_day always reflects real completion rather than something the
// renderer decides on its own.
import type Database from 'better-sqlite3'

interface CountRow {
  total: number
  openCount: number
}

/**
 * Recomputes whether `noteId` is a "perfect day" (has tasks, and none of
 * them are open) and saves the result on the note. Returns the new value so
 * callers can react immediately (e.g. show the stamp + play the bee
 * celebration) without a second read.
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
