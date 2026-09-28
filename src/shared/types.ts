// TL;DR: the "what does a post-it / task / day look like" definitions that
// both the backstage (main) and the screens (renderer) agree on.
//
// Shared data shapes used by main, preload, and renderer. Kept as plain
// TypeScript interfaces (no classes, no generics) since these are just
// "shape of the data" descriptions - this is the beginner-friendly level of
// TypeScript the project intentionally sticks to.

/** The default title/colour every new day starts with, and what rollover falls back to. */
export const DEFAULT_NOTE_TITLE = "today's buzz"
export const DEFAULT_NOTE_COLOUR = '#F6C56A'

/**
 * A single post-it note. Milestone 8b: a calendar day can have several of
 * these (one per post-it the user created), not just one - `noteDate` says
 * which day it belongs to, `title`/`colour` say which post-it it is.
 */
export interface Note {
  id: number
  /** ISO calendar date, e.g. "2026-09-27". */
  noteDate: string
  /** User-chosen name, e.g. "today's buzz", "School", "Personal". Renamable by clicking it. */
  title: string
  /** Hex colour, e.g. "#F6C56A", chosen when the post-it was created. */
  colour: string
  /** True once this note is no longer editable - its unfinished tasks have rolled over and it's read-only history. */
  sealed: boolean
  /** True once every task on this note was completed at least once (the "perfect day" badge). */
  perfectDay: boolean
  /** Pixel position on the board, if the user has dragged this note. Null until first dragged - the board then falls back to its default pinned layout. */
  boardX: number | null
  boardY: number | null
  createdAt: string
}

/** A note plus how many tasks are on it - what the board needs to show "4 tasks" without a second round-trip per note. */
export interface BoardNote extends Note {
  taskCount: number
}

/** A task's completion state. A plain union type - only these two strings are valid. */
export type TaskStatus = 'open' | 'done'

export interface Task {
  id: number
  noteId: number
  title: string
  status: TaskStatus
  createdAt: string
}

/** Input shape for creating a task - no id/status/createdAt, the database assigns those. */
export interface NewTask {
  title: string
}

/**
 * One calendar day of history for the board - one day at a time (not a
 * week). dayOffset 0 is today, negative is the past, positive is the
 * future - browsing is unbounded in both directions, since users can plan
 * post-its ahead of time as well as look back at history. isPast marks a
 * read-only day (its post-its are sealed history); today and every future
 * day are editable. Milestone 8b: notes is a list (a day can have several
 * post-its), each with its own task count for the board's "N tasks" label.
 */
export interface DayResult {
  notes: BoardNote[]
  dateLabel: string
  dayOffset: number
  isToday: boolean
  isPast: boolean
}

/**
 * The saved Obsidian vault folder, plus whether it currently exists on disk.
 * `path` is null until the user has chosen a folder in Settings at least once.
 */
export interface VaultStatus {
  path: string | null
  exists: boolean
}
