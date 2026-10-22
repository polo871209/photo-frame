import type { CalendarInfo, EventsResponse } from "../../shared/events";
import { addDays, parseLocalDate, startOfDay } from "../lib/dates";

export interface Occurrence {
  id: string;
  calendar: CalendarInfo;
  title: string;
  allDay: boolean;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
}

export function toOccurrences(
  response: EventsResponse,
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const calendars = new Map(response.calendars.map((c) => [c.id, c]));
  const occurrences: Occurrence[] = [];
  for (const event of response.events) {
    const calendar = calendars.get(event.calendarId);
    if (!calendar) continue;
    const start = event.allDay
      ? parseLocalDate(event.start)
      : new Date(event.start);
    const end = event.allDay ? parseLocalDate(event.end) : new Date(event.end);
    if (start >= rangeEnd || end <= rangeStart) continue;
    occurrences.push({ ...event, calendar, start, end });
  }
  return occurrences.sort(
    (a, b) =>
      +a.start - +b.start || +b.end - +a.end || a.title.localeCompare(b.title),
  );
}

export function onDay(occurrences: Occurrence[], day: Date): Occurrence[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return occurrences.filter((o) => o.start < dayEnd && o.end > dayStart);
}

export function colorVars(hex: string): string {
  const value = parseInt(hex.replace("#", ""), 16);
  const rgb = `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
  return `--c:${hex};--c-rgb:${rgb};`;
}
