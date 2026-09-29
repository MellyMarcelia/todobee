// Small helpers for working with dates: turning a date into text like
// "2026-09-27" and back, moving forward or back a number of days, and
// making the friendly "Sun 27 Sep 2026" label shown on the board.
//
// Everything here uses the date on your own computer's clock, so "today"
// always means your today, wherever you are in the world.

// Adds a leading zero to single digits (7 becomes "07").
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Turns a date into text like "2026-09-27". */
export function formatDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** The opposite: turns text like "2026-09-27" back into a date. */
export function parseDateString(dateString: string): Date {
  // Split "2026-09-27" into 2026, 9 and 27.
  const [year, month, day] = dateString.split('-').map(Number)
  // Computers count months from 0 (January = 0), hence the "- 1".
  return new Date(year, month - 1, day)
}

/** Moves a date forward by some number of days (a negative number goes back). */
export function addDays(date: Date, days: number): Date {
  // Make a copy first, so the date we were given isn't changed by accident.
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// Short names for the months and weekdays, used in the label below. They're
// in the same order the computer counts them (January and Sunday come first).
const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Makes the friendly label shown at the top of the board, e.g. "Sun 27 Sep 2026". */
export function formatLongDate(date: Date): string {
  return `${SHORT_DAY_NAMES[date.getDay()]} ${date.getDate()} ${SHORT_MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}
