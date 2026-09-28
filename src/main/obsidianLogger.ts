// TL;DR: every time you add/tick/edit/delete a task, this writes one line
// about it into a daily Markdown file in your Obsidian vault. It only ever
// adds lines, never changes old ones.
//
// Append-only Obsidian logging (Milestone 6). One bullet line per task
// event, appended to <vault>/Todobee/Tasks/YYYY/YYYY-MM/YYYY-MM-DD.md - the
// file for the day the event actually happened (in the user's local
// timezone). Never rewrites or truncates existing content: every write here
// uses fs.appendFileSync, which only ever adds bytes to the end of the file.
import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'

/** The six task events this logger knows how to write a line for. */
export type TaskEventType =
  'task.created' | 'task.edited' | 'task.completed' | 'task.reopened' | 'task.deleted'

export interface TaskEvent {
  type: TaskEventType
  status: 'open' | 'done'
  title: string
  /** Which post-it the task lives on, e.g. "today's buzz", "School" - Milestone 8b. */
  noteTitle: string
  /**
   * Set only for the rollover case: a task.edited event that moved a task
   * onto today's note from an earlier note. Renders as "moved from YYYY-MM-DD".
   */
  movedFrom?: string
  /**
   * Set only when the user postpones a task with "move this to the next
   * day": a task.edited event logged on the day it was moved away from.
   * Renders as "moved to YYYY-MM-DD".
   */
  movedTo?: string
}

/** Pads a number to 2 digits, e.g. 7 -> "07". Used for both dates and times. */
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Reads a Date's calendar date/time fields as they appear in a given IANA
 * timezone (not the system timezone, not UTC). Intl.DateTimeFormat with a
 * `timeZone` option is the standard way to do this in JavaScript - it's
 * effectively "what would a clock on the wall in that timezone show?".
 */
function partsInTimeZone(
  date: Date,
  timeZone: string
): { year: string; month: string; day: string; hour: string; minute: string; second: string } {
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
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]))
  // Some locales/environments render midnight as "24" instead of "00" - normalize it.
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

/** The UTC offset for a timezone at a given instant, as "+02:00" / "-04:00". */
function utcOffset(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset'
  })
  const tzPart =
    formatter.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0'
  // tzPart looks like "GMT+2" or "GMT-4:30" - normalize to "+02:00" / "-04:30".
  const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/)
  if (!match) return '+00:00'
  const sign = match[1]
  const hours = pad2(Number(match[2]))
  const minutes = pad2(Number(match[3] ?? '0'))
  return `${sign}${hours}:${minutes}`
}

/**
 * Formats an instant as "YYYY-MM-DD HH:MM:SS (Zone/Name, UTC+HH:MM)" in the
 * given timezone - the exact timestamp format required on every log line.
 */
export function formatTimestamp(date: Date, timeZone: string): string {
  const p = partsInTimeZone(date, timeZone)
  const offset = utcOffset(date, timeZone)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} (${timeZone}, UTC${offset})`
}

/** Formats one bullet line for a task event, in the exact spec format. */
export function formatLogLine(event: TaskEvent, date: Date, timeZone: string): string {
  const timestamp = formatTimestamp(date, timeZone)
  let line = `- **${timestamp}** - \`${event.type}\` - Status: ${event.status} - "${event.title}" - Note: "${event.noteTitle}"`
  if (event.movedFrom) line += ` - moved from ${event.movedFrom}`
  if (event.movedTo) line += ` - moved to ${event.movedTo}`
  return line
}

/**
 * The log file path for the day an event happened, in the given timezone -
 * <vault>/Todobee/Tasks/YYYY/YYYY-MM/YYYY-MM-DD.md. Using the timezone-local
 * date (not UTC) matters right at the day boundary: an event just after
 * midnight local time must not land in the previous UTC day's file.
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
 * Appends one bullet line for a task event to the vault's log file for the
 * day it happened, creating any missing folders/file along the way.
 *
 * Safe by design, never throws or crashes the app:
 * - vaultPath is null (no vault chosen yet) -> silently does nothing.
 * - the vault folder doesn't exist on disk (moved/deleted) -> silently does
 *   nothing, rather than recreating a folder the user removed on purpose.
 * - any other filesystem error (permissions, disk full, etc.) -> logged to
 *   the console but swallowed, since a logging failure must never break
 *   the app's actual task management.
 *
 * Uses appendFileSync, which only ever adds bytes to the end of a file -
 * it cannot rewrite or truncate lines that are already there, even across
 * separate app restarts.
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
    const filePath = logFilePath(vaultPath, date, timeZone)
    mkdirSync(dirname(filePath), { recursive: true })
    appendFileSync(filePath, formatLogLine(event, date, timeZone) + '\n', 'utf-8')
  } catch (error) {
    console.error('Failed to append Obsidian log line:', error)
  }
}
