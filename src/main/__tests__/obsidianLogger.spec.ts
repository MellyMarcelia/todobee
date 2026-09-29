// Automatic checks for the Obsidian task log (obsidianLogger.ts): how each
// line is worded, which file it goes into, and that writing it can never
// break the app. Run them with "npm test".
import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { formatTimestamp, formatLogLine, logFilePath, appendTaskEvent } from '../obsidianLogger'

// Every test uses this same moment in time, so the answers are always the
// same. 17:30:12 world time (UTC) on 27 Sep 2026 is 19:30:12 in Brussels
// (2 hours ahead in summer). It matches the example line from the plan.
const FIXED_INSTANT = new Date('2026-09-27T17:30:12.000Z')

// The date and time at the start of each line, in different time zones.
describe('formatTimestamp', () => {
  it('formats date, time, and timezone name + UTC offset together', () => {
    expect(formatTimestamp(FIXED_INSTANT, 'Europe/Brussels')).toBe(
      '2026-09-27 19:30:12 (Europe/Brussels, UTC+02:00)'
    )
  })

  it('uses the local date/time for a different timezone, not UTC', () => {
    // 17:30:12 UTC is 13:30:12 in America/New_York (UTC-04:00 in September).
    expect(formatTimestamp(FIXED_INSTANT, 'America/New_York')).toBe(
      '2026-09-27 13:30:12 (America/New_York, UTC-04:00)'
    )
  })
})

// The full wording of one log line.
describe('formatLogLine', () => {
  it('starts with a markdown bullet ("- ")', () => {
    const line = formatLogLine(
      { type: 'task.created', status: 'open', title: 'kerjain pr', noteTitle: "today's buzz" },
      FIXED_INSTANT,
      'Europe/Brussels'
    )
    expect(line.startsWith('- ')).toBe(true)
  })

  it('matches the exact bullet format from the spec, including the note title', () => {
    const line = formatLogLine(
      { type: 'task.created', status: 'open', title: 'kerjain pr', noteTitle: 'School' },
      FIXED_INSTANT,
      'Europe/Brussels'
    )
    expect(line).toBe(
      '- **2026-09-27 19:30:12 (Europe/Brussels, UTC+02:00)** - `task.created` - Status: open - "kerjain pr" - Note: "School"'
    )
  })

  it('appends a "moved from" note for rollover-triggered edits', () => {
    const line = formatLogLine(
      {
        type: 'task.edited',
        status: 'open',
        title: 'kerjain pr',
        noteTitle: "today's buzz",
        movedFrom: '2026-09-26'
      },
      FIXED_INSTANT,
      'Europe/Brussels'
    )
    expect(line).toBe(
      '- **2026-09-27 19:30:12 (Europe/Brussels, UTC+02:00)** - `task.edited` - Status: open - "kerjain pr" - Note: "today\'s buzz" - moved from 2026-09-26'
    )
  })

  it('appends a "moved to" note when a task is postponed to the next day', () => {
    const line = formatLogLine(
      {
        type: 'task.edited',
        status: 'open',
        title: 'kerjain pr',
        noteTitle: 'School',
        movedTo: '2026-09-28'
      },
      FIXED_INSTANT,
      'Europe/Brussels'
    )
    expect(line).toBe(
      '- **2026-09-27 19:30:12 (Europe/Brussels, UTC+02:00)** - `task.edited` - Status: open - "kerjain pr" - Note: "School" - moved to 2026-09-28'
    )
  })
})

// Which file (and folders) a line goes into.
describe('logFilePath', () => {
  it('builds <vault>/Todobee/Tasks/YYYY/YYYY-MM/YYYY-MM-DD.md from the local date', () => {
    const path = logFilePath('/vault', FIXED_INSTANT, 'Europe/Brussels')
    expect(path).toBe(join('/vault', 'Todobee', 'Tasks', '2026', '2026-09', '2026-09-27.md'))
  })

  it('uses the timezone-local date at the day boundary, not the UTC date', () => {
    // 2026-01-01T02:00:00Z is still 2025-12-31 21:00 in America/New_York.
    const nearMidnightUtc = new Date('2026-01-01T02:00:00.000Z')
    const path = logFilePath('/vault', nearMidnightUtc, 'America/New_York')
    expect(path).toBe(join('/vault', 'Todobee', 'Tasks', '2025', '2025-12', '2025-12-31.md'))
  })
})

// Actually writing lines to a file. These tests make a pretend vault in
// the computer's temporary folder, so your real vault is never touched.
describe('appendTaskEvent', () => {
  let vaultDir: string

  // After every test: throw the pretend vault away.
  afterEach(() => {
    if (vaultDir) rmSync(vaultDir, { recursive: true, force: true })
  })

  it('creates the folders and file when they do not exist yet', () => {
    vaultDir = mkdtempSync(join(tmpdir(), 'todobee-vault-'))
    appendTaskEvent(
      vaultDir,
      { type: 'task.created', status: 'open', title: 'kerjain pr', noteTitle: "today's buzz" },
      FIXED_INSTANT,
      'Europe/Brussels'
    )

    const filePath = logFilePath(vaultDir, FIXED_INSTANT, 'Europe/Brussels')
    expect(existsSync(filePath)).toBe(true)
    expect(readFileSync(filePath, 'utf-8')).toBe(
      '- **2026-09-27 19:30:12 (Europe/Brussels, UTC+02:00)** - `task.created` - Status: open - "kerjain pr" - Note: "today\'s buzz"\n'
    )
  })

  it('append never overwrites existing content, even across separate calls', () => {
    vaultDir = mkdtempSync(join(tmpdir(), 'todobee-vault-'))
    appendTaskEvent(
      vaultDir,
      { type: 'task.created', status: 'open', title: 'first task', noteTitle: "today's buzz" },
      FIXED_INSTANT,
      'Europe/Brussels'
    )
    appendTaskEvent(
      vaultDir,
      { type: 'task.completed', status: 'done', title: 'first task', noteTitle: "today's buzz" },
      new Date('2026-09-27T18:00:00.000Z'),
      'Europe/Brussels'
    )

    const filePath = logFilePath(vaultDir, FIXED_INSTANT, 'Europe/Brussels')
    const lines = readFileSync(filePath, 'utf-8').trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('task.created')
    expect(lines[0]).toContain('"first task"')
    expect(lines[1]).toContain('task.completed')
  })

  it('does nothing and does not throw when no vault path is set', () => {
    expect(() =>
      appendTaskEvent(
        null,
        { type: 'task.created', status: 'open', title: 'x', noteTitle: "today's buzz" },
        FIXED_INSTANT
      )
    ).not.toThrow()
  })

  it('does nothing and does not throw when the vault folder does not exist', () => {
    expect(() =>
      appendTaskEvent(
        '/this/path/does/not/exist/at/all',
        { type: 'task.created', status: 'open', title: 'x', noteTitle: "today's buzz" },
        FIXED_INSTANT
      )
    ).not.toThrow()
  })
})
