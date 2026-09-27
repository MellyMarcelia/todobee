import { describe, it, expect } from 'vitest'
import {
  formatDateString,
  parseDateString,
  addDays,
  mondayOf,
  isoWeekNumber,
  formatShortDate
} from '../dateUtils'

describe('formatDateString / parseDateString', () => {
  it('round-trips a date through formatDateString and parseDateString', () => {
    const date = new Date(2026, 8, 27) // September 27, 2026 (month is 0-indexed)
    expect(formatDateString(date)).toBe('2026-09-27')
    expect(formatDateString(parseDateString('2026-09-27'))).toBe('2026-09-27')
  })

  it('pads single-digit months and days', () => {
    expect(formatDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('moves forward across a month boundary', () => {
    expect(formatDateString(addDays(parseDateString('2026-09-29'), 3))).toBe('2026-10-02')
  })

  it('moves backward across a year boundary', () => {
    expect(formatDateString(addDays(parseDateString('2026-01-01'), -1))).toBe('2025-12-31')
  })
})

describe('mondayOf', () => {
  it('returns the same date when given a Monday', () => {
    // 2026-09-28 is a Monday.
    expect(formatDateString(mondayOf(parseDateString('2026-09-28')))).toBe('2026-09-28')
  })

  it('returns the preceding Monday for a mid-week date', () => {
    // 2026-10-01 is a Thursday in the week starting Monday 2026-09-28.
    expect(formatDateString(mondayOf(parseDateString('2026-10-01')))).toBe('2026-09-28')
  })

  it('returns the preceding Monday for a Sunday (end of week)', () => {
    // 2026-10-04 is a Sunday, still in the week starting 2026-09-28.
    expect(formatDateString(mondayOf(parseDateString('2026-10-04')))).toBe('2026-09-28')
  })
})

describe('isoWeekNumber', () => {
  it('matches the known ISO week for a real date (2026-09-27 is week 39)', () => {
    expect(isoWeekNumber(parseDateString('2026-09-27'))).toBe(39)
  })

  it('matches the known ISO week at the start of the year', () => {
    // 2026-01-01 is a Thursday, so it's in ISO week 1 of 2026.
    expect(isoWeekNumber(parseDateString('2026-01-01'))).toBe(1)
  })
})

describe('formatShortDate', () => {
  it('formats a date as "Mon D"', () => {
    expect(formatShortDate(parseDateString('2026-09-28'))).toBe('Sep 28')
  })

  it('does not zero-pad the day', () => {
    expect(formatShortDate(parseDateString('2026-01-05'))).toBe('Jan 5')
  })
})
