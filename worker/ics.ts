import ICAL from "ical.js";
import type { CalendarEvent } from "../shared/events";

const MAX_OCCURRENCES_PER_EVENT = 5000;
const DAY_MS = 864e5;
const UNKNOWN_ZONE_SLACK_MS = DAY_MS;
const RANGE_SLACK_MS = 2 * DAY_MS;
const EVENT_BLOCK = /BEGIN:VEVENT\r?\n[\s\S]*?END:VEVENT(?:\r?\n|$)/g;
const RECURS = /^(?:RRULE|RDATE)[;:]/m;
const HAS_DURATION = /^DURATION[;:]/m;
const DTSTART_DAY = /^DTSTART(?:;[^:\r\n]*)?:(\d{8})/m;
const DTEND_DAY = /^DTEND(?:;[^:\r\n]*)?:(\d{8})/m;
const RECURRENCE_ID_DAY = /^RECURRENCE-ID(?:;[^:\r\n]*)?:(\d{8})/m;
const DTSTAMP_LINE = /^DTSTAMP[;:].*\r?\n/m;
const CALENDAR_END = "END:VCALENDAR";

export function expandIcs(
  text: string,
  calendarId: string,
  from: Date,
  to: Date,
): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const zone of root.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(zone);
  }

  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const component of root.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component, {
      strictExceptions: true,
      exceptions: [],
    });
    if (event.isRecurrenceException()) exceptions.push(event);
    else masters.set(event.uid, event);
  }

  const singles: ICAL.Event[] = [];
  for (const exception of exceptions) {
    const master = masters.get(exception.uid);
    if (master) master.relateException(exception);
    else singles.push(exception);
  }

  const out: CalendarEvent[] = [];
  const keep = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time) => {
    const occurrence = toOccurrence(item, start, end, calendarId);
    if (occurrence && overlaps(occurrence, from, to)) out.push(occurrence);
  };

  for (const event of [...masters.values(), ...singles]) {
    if (!event.isRecurring()) {
      keep(event, event.startDate, event.endDate);
      continue;
    }
    const start = fastForward(event, from);
    const expansion = event.iterator(start);
    for (let count = 0; count < MAX_OCCURRENCES_PER_EVENT; count++) {
      const next = expansion.next();
      if (!next || next.toJSDate() >= to) break;
      const details = event.getOccurrenceDetails(next);
      keep(details.item, details.startDate, details.endDate);
    }
    for (const exception of Object.values(event.exceptions)) {
      if (exception.recurrenceId.compare(start) < 0) {
        keep(exception, exception.startDate, exception.endDate);
      }
    }
  }
  return out;
}

/**
 * Returns the feed with only the events that can occur in the range: every series, and single events near it.
 * The result is the same for the same events, so it can key a cache.
 */
export function nearEvents(text: string, from: Date, to: Date): string {
  const first = compactDay(+from - RANGE_SLACK_MS);
  const last = compactDay(+to + RANGE_SLACK_MS);
  const near = (start: string, end: string) => start <= last && end >= first;
  const kept: string[] = [];
  const rest = text.replace(EVENT_BLOCK, (block) => {
    const start = DTSTART_DAY.exec(block)?.[1];
    const recurrenceId = RECURRENCE_ID_DAY.exec(block)?.[1];
    if (
      RECURS.test(block) ||
      !start ||
      near(start, endDay(block, start)) ||
      (recurrenceId && near(recurrenceId, recurrenceId))
    ) {
      // Google lists the events in a new order on each download, and DTSTAMP is the download time (RFC 5545, 3.8.7.2).
      kept.push(block.replace(DTSTAMP_LINE, ""));
    }
    return "";
  });
  const end = rest.lastIndexOf(CALENDAR_END);
  return rest.slice(0, end) + kept.sort().join("") + rest.slice(end);
}

function endDay(block: string, startDay: string): string {
  if (HAS_DURATION.test(block)) return "99999999";
  return DTEND_DAY.exec(block)?.[1] ?? startDay;
}

function compactDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10).replaceAll("-", "");
}

// ical.js expands a series from DTSTART, so start a daily or weekly series whole periods later, just before the range.
// ical.js also yields the new start itself, which lies before the range, so overlaps() drops it.
function fastForward(event: ICAL.Event, from: Date): ICAL.Time {
  const rules = event.component.getAllProperties("rrule");
  const rule = rules[0]?.getFirstValue() as ICAL.Recur | undefined;
  if (rules.length !== 1 || !rule || rule.count) return event.startDate;
  const periodDays =
    rule.freq === "DAILY"
      ? rule.interval
      : rule.freq === "WEEKLY"
        ? 7 * rule.interval
        : 0;
  if (!periodDays) return event.startDate;
  const startMs = +event.startDate.toJSDate();
  const durationMs = +event.endDate.toJSDate() - startMs;
  const gapDays = (+from - RANGE_SLACK_MS - durationMs - startMs) / DAY_MS;
  const periods = Math.floor(gapDays / periodDays);
  if (periods <= 0) return event.startDate;
  const start = event.startDate.clone();
  start.adjust(periods * periodDays, 0, 0, 0);
  return start;
}

function toOccurrence(
  item: ICAL.Event,
  start: ICAL.Time,
  end: ICAL.Time,
  calendarId: string,
): CalendarEvent | null {
  if (item.component.getFirstPropertyValue("status") === "CANCELLED")
    return null;
  const allDay = start.isDate;
  let endValue = allDay ? end.toString() : end.toJSDate().toISOString();
  if (allDay && endValue <= start.toString()) {
    const next = start.clone();
    next.adjust(1, 0, 0, 0);
    endValue = next.toString();
  }
  return {
    id: `${calendarId}:${item.uid}:${start.toString()}`,
    calendarId,
    title: item.summary || "(No title)",
    allDay,
    start: allDay ? start.toString() : start.toJSDate().toISOString(),
    end: endValue,
    location: item.location || undefined,
    description: plainText(item.description),
  };
}

function overlaps(event: CalendarEvent, from: Date, to: Date): boolean {
  if (event.allDay) return allDayMayOverlap(event, from, to);
  return new Date(event.start) < to && new Date(event.end) > from;
}

function allDayMayOverlap(event: CalendarEvent, from: Date, to: Date): boolean {
  return (
    Date.parse(event.start) < +to + UNKNOWN_ZONE_SLACK_MS &&
    Date.parse(event.end) > +from - UNKNOWN_ZONE_SLACK_MS
  );
}

// Google Calendar writes HTML into DESCRIPTION.
function plainText(html: string | null | undefined): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
  return text || undefined;
}
