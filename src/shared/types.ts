// Shared data shapes used by main, preload, and renderer. Kept as plain
// TypeScript interfaces (no classes, no generics) since these are just
// "shape of the data" descriptions — this is the beginner-friendly level of
// TypeScript the project intentionally sticks to.

/** A single day's note. One row per calendar day. */
export interface Note {
  id: number
  /** ISO calendar date, e.g. "2026-09-27". */
  noteDate: string
  /** True once this note is no longer today's note — its unfinished tasks have rolled over and it's read-only history. */
  sealed: boolean
  /** True once every task on this note was completed at least once (the "perfect day" badge). */
  perfectDay: boolean
  createdAt: string
}

/** A task's completion state. A plain union type — only these two strings are valid. */
export type TaskStatus = 'open' | 'done'

export interface Task {
  id: number
  noteId: number
  title: string
  status: TaskStatus
  createdAt: string
}

/** Input shape for creating a task — no id/status/createdAt, the database assigns those. */
export interface NewTask {
  title: string
}

/**
 * The saved Obsidian vault folder, plus whether it currently exists on disk.
 * `path` is null until the user has chosen a folder in Settings at least once.
 */
export interface VaultStatus {
  path: string | null
  exists: boolean
}
