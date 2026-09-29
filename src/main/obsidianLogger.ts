// Your task diary in Obsidian. Every time you add, tick, edit or delete a
// task, one line about it is written to that day's file, at:
//   <your vault>/Todobee/Tasks/2026/2026-09/2026-09-27.md
// It only ever adds new lines to the end - it never changes or removes
// anything already written.
import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'

/** The kinds of task changes that get written to the log. */
export type TaskEventType =
  'task.created' | 'task.edited' | 'task.completed' | 'task.reopened' | 'task.deleted'

/** Everything needed to write one log line. */
export interface TaskEvent {
  type: TaskEventType
  status: 'open' | 'done'
  title: string
  /** Which post-it the task is on, e.g. "today's buzz", "School". */
  noteTitle: string
  /** Only for a task carried over from an earlier day: adds "moved from <date>". */
  movedFrom?: string
  /** Only for a task pushed to tomorrow with the button: adds "moved to <date>". */
  movedTo?: string
}

/** Adds a leading zero to single digits (7 becomes "07"). */
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Splits a moment in time into year, month, day, hour, minute and second,
 * as a wall clock in the given time zone (e.g. "Europe/Paris") would show it.
 */
function partsInTimeZone(
  date: Date,
  timeZone: string
): { year: string; month: string; day: string; hour: string; minute: string; second: string } {
  // Ask the computer's built-in date tool to read the clock in that time
  // zone, as numbers (e.g. "2026", "09", "27", "14"...).
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  // Turn its answer into an easy lookup: parts.year, parts.month, and so on.
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]))
  // Some computers write midnight as "24" instead of "00" - fix that.
  const hour = parts.hour === '24' ? '00' : parts.hour
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour,
    minute: parts.minute,
    second: parts.second
  }
}

/** How many hours a time zone is ahead of or behind world time (UTC), e.g. "+02:00". */
function utcOffset(date: Date, timeZone: string): string {
  // Ask the computer how far this time zone is from world time.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset'
  })
  const tzPart =
    formatter.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0'
  // The computer gives us something like "GMT+2" - turn it into "+02:00".
  const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/)
  if (!match) return '+00:00'
  const sign = match[1]
  const hours = pad2(Number(match[2]))
  const minutes = pad2(Number(match[3] ?? '0'))
  return `${sign}${hours}:${minutes}`
}

/** The date and time at the start of each log line, e.g. "2026-09-27 14:05:09 (Europe/Paris, UTC+02:00)". */
export function formatTimestamp(date: Date, timeZone: string): string {
  const p = partsInTimeZone(date, timeZone)
  const offset = utcOffset(date, timeZone)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} (${timeZone}, UTC${offset})`
}

/** Builds one full log line (a bullet point) describing a task change. */
export function formatLogLine(event: TaskEvent, date: Date, timeZone: string): string {
  const timestamp = formatTimestamp(date, timeZone)
  // The basic line: when, what happened, done or not, the task, and its post-it.
  let line = `- **${timestamp}** - \`${event.type}\` - Status: ${event.status} - "${event.title}" - Note: "${event.noteTitle}"`
  // Add the "moved from/to" part only if the task was moved.
  if (event.movedFrom) line += ` - moved from ${event.movedFrom}`
  if (event.movedTo) line += ` - moved to ${event.movedTo}`
  return line
}

/**
 * Works out which file a log line goes into, based on your local date. So
 * a task ticked at 00:30 goes into the new day's file, not yesterday's.
 */
export function logFilePath(vaultPath: string, date: Date, timeZone: string): string {
  const p = partsInTimeZone(date, timeZone)
  return join(
    vaultPath,
    'Todobee',
    'Tasks',
    p.year,
    `${p.year}-${p.month}`,
    `${p.year}-${p.month}-${p.day}.md`
  )
}

/**
 * Adds one line to today's log file, creating the folders and file if
 * they don't exist yet.
 *
 * This can never crash the app:
 * - No vault folder picked yet? Do nothing.
 * - Vault folder moved or deleted? Do nothing (we don't recreate a folder
 *   you may have removed on purpose).
 * - Anything else goes wrong (no permission, disk full...)? Note the error
 *   for developers and carry on.
 */
export function appendTaskEvent(
  vaultPath: string | null,
  event: TaskEvent,
  date: Date = new Date(),
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
): void {
  if (!vaultPath) return
  if (!existsSync(vaultPath)) return

  try {
    // Work out today's file, make its folders if they're missing, then add
    // the line to the very end of the file.
    const filePath = logFilePath(vaultPath, date, timeZone)
    mkdirSync(dirname(filePath), { recursive: true })
    appendFileSync(filePath, formatLogLine(event, date, timeZone) + '\n', 'utf-8')
  } catch (error) {
    console.error('Failed to append Obsidian log line:', error)
  }
}
