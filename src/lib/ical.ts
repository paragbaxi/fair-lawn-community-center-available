import { getEasternNow, DISPLAY_DAYS } from './time.js'

const LOCATION = 'Fair Lawn Community Center, 10-10 20th Street, Fair Lawn, NJ 07410'

export interface ICalSession {
  day: string
  startTime: string
  endTime: string
  activity: string
}

/**
 * Parse a 12-hour time string like "10:00 AM" or "2:30 PM" into { hours, minutes }.
 * Returns { hours: 0, minutes: 0 } if the string cannot be parsed.
 */
function parseTimeStr(timeStr: string): { hours: number; minutes: number } {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return { hours: 0, minutes: 0 }

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3].toUpperCase()

  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0

  return { hours, minutes }
}

/**
 * Format a Date as iCal local datetime string: YYYYMMDDTHHmmss
 */
function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    String(d.getFullYear()) +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  )
}

/**
 * Format a Date as iCal UTC datetime string: YYYYMMDDTHHmmssZ
 */
function formatUTCDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    String(d.getUTCFullYear()) +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

/**
 * Given the current Eastern "now" date, compute the Monday of the current week
 * (treating the week as Mon–Sun) and return it as a plain local Date.
 */
function getMondayOfCurrentWeek(now: Date): Date {
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysFromMonday = (dayOfWeek + 6) % 7 // Mon=0, Tue=1, ..., Sun=6
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday)
  return monday
}

/**
 * Return the offset (0-based) of a day name within the Mon–Sun display order.
 * e.g. Monday→0, Tuesday→1, ..., Sunday→6
 */
function dayOffset(dayName: string): number {
  const idx = DISPLAY_DAYS.findIndex((d) => d.full === dayName)
  return idx >= 0 ? idx : 0
}

/**
 * Compute the actual calendar Date for a given day name within the current week.
 */
function dateForDay(dayName: string, monday: Date): Date {
  const offset = dayOffset(dayName)
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset)
}

/**
 * Escape special iCal characters in text values (commas, semicolons, backslashes).
 */
function escapeICalText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

/**
 * Fold long iCal content lines at 75 octets as required by RFC 5545 §3.1.
 * Continuation lines begin with a single space.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  chunks.push(line.slice(0, 75))
  let i = 75
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74))
    i += 74
  }
  return chunks.join('\r\n')
}

/**
 * Generate a valid RFC 5545 .ics file string for the given sport's sessions.
 *
 * @param sportLabel  Display name of the sport (e.g. "Basketball")
 * @param sessions    Array of sessions with day, startTime, endTime, and activity name
 * @returns           A string suitable for saving as a .ics file
 */
export function generateICS(sportLabel: string, sessions: ICalSession[]): string {
  const now = getEasternNow()
  const utcNow = new Date()
  const monday = getMondayOfCurrentWeek(now)
  const dtstamp = formatUTCDateTime(utcNow)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fair Lawn Community Center//FLCC Sports Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const session of sessions) {
    const dayDate = dateForDay(session.day, monday)
    const { hours: startH, minutes: startM } = parseTimeStr(session.startTime)
    const { hours: endH, minutes: endM } = parseTimeStr(session.endTime)

    const dtstart = formatLocalDateTime(
      new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), startH, startM, 0),
    )
    const dtend = formatLocalDateTime(
      new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), endH, endM, 0),
    )

    const uid = `${session.day}-${session.startTime}-${sportLabel}@flcc`
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9@\-_.]/g, '')

    lines.push('BEGIN:VEVENT')
    lines.push(foldLine(`UID:${uid}`))
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`DTSTART;TZID=America/New_York:${dtstart}`)
    lines.push(`DTEND;TZID=America/New_York:${dtend}`)
    lines.push(foldLine(`SUMMARY:${escapeICalText(session.activity)}`))
    lines.push(foldLine(`LOCATION:${escapeICalText(LOCATION)}`))
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  return lines.join('\r\n') + '\r\n'
}
