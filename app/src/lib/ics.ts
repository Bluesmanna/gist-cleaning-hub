// Export shifts as an .ics calendar (Google Calendar, Apple, Outlook all import it).
import type { Client, Shift } from './types'

const stamp = (day: string, hhmm: string) => `${day.replace(/-/g, '')}T${hhmm.replace(':', '')}00`
const esc = (s: string) => s.replace(/[\,;]/g, (m) => `\${m}`).replace(/\n/g, '\n')

export function shiftsToIcs(shifts: Shift[], clients: Client[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GIST Cleaning Hub//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:GIST shifts', 'X-WR-TIMEZONE:America/Los_Angeles']
  for (const s of shifts) {
    const c = clients.find((x) => x.id === s.clientId)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@gist-hub`,
      `DTSTAMP:${stamp(s.date, s.start)}`,
      `DTSTART:${stamp(s.date, s.start)}`,
      `DTEND:${stamp(s.date, s.end)}`,
      `SUMMARY:${esc(`GIST: ${c?.household || 'Shift'}`)}`,
      `LOCATION:${esc(c?.address || '')}`,
      `DESCRIPTION:${esc(`${s.jobTitle}${s.note ? `\n${s.note}` : ''}`)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
