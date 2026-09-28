// Describes what our data looks like - a post-it, a task, a day on the
// board - so every part of the app agrees on the same shapes.

/** The name and colour a brand-new day's post-it starts with. */
export const DEFAULT_NOTE_TITLE = "today's buzz"
export const DEFAULT_NOTE_COLOUR = '#F6C56A'

/** One post-it. A day can have several of them. */
export interface Note {
  id: number
  /** Which day the post-it belongs to, e.g. "2026-09-27". */
  noteDate: string
  /** The post-it's name, e.g. "today's buzz", "School". Click it to rename. */
  title: string
  /** The post-it's colour, e.g. "#F6C56A". */
  colour: string
  /** True once the day is over: the post-it is locked and can only be looked at. */
  sealed: boolean
  /** True when every task on it is done - it gets the "good job" stamp. */
  perfectDay: boolean
  /** Where you dragged it to on the board. Empty (null) until you've moved it once. */
  boardX: number | null
  boardY: number | null
  createdAt: string
}

/** A post-it plus how many tasks it has, for the "3 tasks" label on the board. */
export interface BoardNote extends Note {
  taskCount: number
}

/** A task is either still to do ("open") or finished ("done"). */
export type TaskStatus = 'open' | 'done'

/** One line on a post-it. */
export interface Task {
  id: number
  noteId: number
  title: string
  status: TaskStatus
  createdAt: string
}

/** What you need to create a task - just its text. Everything else is filled in automatically. */
export interface NewTask {
  title: string
}

/**
 * Everything the board needs to show one day.
 * dayOffset counts days from today: 0 is today, -1 is yesterday, 1 is
 * tomorrow, and so on. Past days are locked; today and future days can be
 * changed.
 */
export interface DayResult {
  notes: BoardNote[]
  dateLabel: string
  dayOffset: number
  isToday: boolean
  isPast: boolean
}

/**
 * The Obsidian vault folder you picked, and whether it can still be found.
 * `path` is empty (null) until you pick a folder in Settings.
 */
export interface VaultStatus {
  path: string | null
  exists: boolean
}
