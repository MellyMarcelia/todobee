// Small local-calendar-date helpers shared by rollover/notesRepo/index.ts.
// "Local" matters: note_date strings (e.g. "2026-09-27") represent plain
// calendar days with no attached timezone, so all date math here uses the
// system's local Date getters (getFullYear/getMonth/getDate), never UTC -
// consistent with how todayDateString() in index.ts already builds them.
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Formats a Date's local calendar date as "YYYY-MM-DD". */
export function formatDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Parses a "YYYY-MM-DD" string into a local-midnight Date for that day. */
export function parseDateString(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Returns a new Date offset by `days` (negative goes backwards). */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

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

/** Formats a Date as "Ddd D Mon YYYY" (e.g. "Sun 27 Sep 2026") for the board's day header. */
export function formatLongDate(date: Date): string {
  return `${SHORT_DAY_NAMES[date.getDay()]} ${date.getDate()} ${SHORT_MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}
