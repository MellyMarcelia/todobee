import { describe, it, expect } from 'vitest'
import { formatDateString, parseDateString, addDays, formatLongDate } from '../dateUtils'

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

describe('formatLongDate', () => {
  it('formats a date as "Ddd D Mon YYYY"', () => {
    // 2026-09-27 is a Sunday.
    expect(formatLongDate(parseDateString('2026-09-27'))).toBe('Sun 27 Sep 2026')
  })

  it('does not zero-pad the day', () => {
    // 2026-01-05 is a Monday.
    expect(formatLongDate(parseDateString('2026-01-05'))).toBe('Mon 5 Jan 2026')
  })
})
