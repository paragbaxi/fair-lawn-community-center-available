import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateICS } from './ical.js'
import type { ICalSession } from './ical.js'

// We mock getEasternNow so that tests are deterministic.
// Wednesday 2026-02-25 is the reference date — that week's Monday is 2026-02-23.
vi.mock('./time.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./time.js')>()
  return {
    ...actual,
    getEasternNow: () => new Date(2026, 1, 25, 10, 0, 0), // Wed Feb 25 2026, 10:00 AM local
  }
})

const basketballSessions: ICalSession[] = [
  { day: 'Monday', startTime: '12:00 PM', endTime: '2:00 PM', activity: 'Basketball' },
  { day: 'Wednesday', startTime: '6:00 PM', endTime: '8:00 PM', activity: 'Basketball League' },
]

describe('generateICS', () => {
  it('wraps output in VCALENDAR with required headers', () => {
    const ics = generateICS('Basketball', basketballSessions)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('PRODID:')
    expect(ics).toContain('CALSCALE:GREGORIAN')
    expect(ics).toContain('METHOD:PUBLISH')
  })

  it('produces one VEVENT per session', () => {
    const ics = generateICS('Basketball', basketballSessions)
    const beginCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length
    const endCount = (ics.match(/END:VEVENT/g) ?? []).length
    expect(beginCount).toBe(2)
    expect(endCount).toBe(2)
  })

  it('formats DTSTART and DTEND in YYYYMMDDTHHmmss format for Eastern time', () => {
    const ics = generateICS('Basketball', [
      { day: 'Monday', startTime: '12:00 PM', endTime: '2:00 PM', activity: 'Basketball' },
    ])
    // Monday of week containing Wed 2026-02-25 is 2026-02-23
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260223T120000')
    expect(ics).toContain('DTEND;TZID=America/New_York:20260223T140000')
  })

  it('assigns correct dates across the week (Monday through Sunday)', () => {
    const sessions: ICalSession[] = [
      { day: 'Monday', startTime: '9:00 AM', endTime: '10:00 AM', activity: 'Test' },
      { day: 'Wednesday', startTime: '9:00 AM', endTime: '10:00 AM', activity: 'Test' },
      { day: 'Sunday', startTime: '9:00 AM', endTime: '10:00 AM', activity: 'Test' },
    ]
    const ics = generateICS('Test', sessions)
    // Week of 2026-02-23 (Mon) to 2026-03-01 (Sun)
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260223T090000') // Monday
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260225T090000') // Wednesday
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260301T090000') // Sunday
  })

  it('includes SUMMARY equal to the activity name', () => {
    const ics = generateICS('Basketball', [
      { day: 'Monday', startTime: '12:00 PM', endTime: '2:00 PM', activity: 'Basketball – Open Gym' },
    ])
    expect(ics).toContain('SUMMARY:Basketball – Open Gym')
  })

  it('includes LOCATION set to the community center address', () => {
    const ics = generateICS('Basketball', basketballSessions)
    // LOCATION line may be folded at 75 chars per RFC 5545; unfold before checking.
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain('LOCATION:Fair Lawn Community Center')
    expect(unfolded).toContain('10-10 20th Street')
    expect(unfolded).toContain('Fair Lawn\\, NJ 07410')
  })

  it('generates unique UIDs for each session', () => {
    const sessions: ICalSession[] = [
      { day: 'Monday', startTime: '10:00 AM', endTime: '12:00 PM', activity: 'Basketball' },
      { day: 'Tuesday', startTime: '10:00 AM', endTime: '12:00 PM', activity: 'Basketball' },
      { day: 'Wednesday', startTime: '6:00 PM', endTime: '8:00 PM', activity: 'Basketball' },
    ]
    const ics = generateICS('Basketball', sessions)
    const uidMatches = ics.match(/^UID:(.+)$/gm) ?? []
    const uids = uidMatches.map((line) => line.replace(/^UID:/, ''))
    const uniqueUids = new Set(uids)
    expect(uniqueUids.size).toBe(sessions.length)
  })

  it('includes @flcc in UIDs', () => {
    const ics = generateICS('Basketball', [
      { day: 'Monday', startTime: '12:00 PM', endTime: '2:00 PM', activity: 'Basketball' },
    ])
    const uidLine = ics.split('\r\n').find((l) => l.startsWith('UID:')) ?? ''
    expect(uidLine).toContain('@flcc')
  })

  it('returns a valid empty calendar when sessions array is empty', () => {
    const ics = generateICS('Basketball', [])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('handles multiple sessions on the same day correctly', () => {
    const sessions: ICalSession[] = [
      { day: 'Friday', startTime: '9:00 AM', endTime: '11:00 AM', activity: 'Pickleball' },
      { day: 'Friday', startTime: '2:00 PM', endTime: '4:00 PM', activity: 'Pickleball' },
    ]
    const ics = generateICS('Pickleball', sessions)
    // Week: Mon 2026-02-23; Friday = 2026-02-27
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260227T090000')
    expect(ics).toContain('DTSTART;TZID=America/New_York:20260227T140000')
    const beginCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length
    expect(beginCount).toBe(2)
  })

  it('uses CRLF line endings throughout', () => {
    const ics = generateICS('Basketball', basketballSessions)
    // Every \n should be preceded by \r
    const lines = ics.split('\r\n')
    // Rejoining with \r\n should reproduce the original (except trailing newline)
    expect(lines.join('\r\n')).toBe(ics)
  })

  it('does not include RRULE (individual events only)', () => {
    const ics = generateICS('Basketball', basketballSessions)
    expect(ics).not.toContain('RRULE')
  })

  it('includes DTSTAMP in UTC format (ends with Z)', () => {
    const ics = generateICS('Basketball', [
      { day: 'Monday', startTime: '12:00 PM', endTime: '2:00 PM', activity: 'Basketball' },
    ])
    const dtstampLine = ics.split('\r\n').find((l) => l.startsWith('DTSTAMP:')) ?? ''
    expect(dtstampLine).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/)
  })
})
