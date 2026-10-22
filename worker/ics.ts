import ICAL from "ical.js";
import type { CalendarEvent } from "../shared/events";

const MAX_OCCURRENCES_PER_EVENT = 5000;
const DAY_MS = 864e5;

/** Expands an iCalendar feed into the occurrences that overlap `[from, to)`. */
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
    const event = new ICAL.Event(component);
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
    const expansion = event.iterator();
    for (let count = 0; count < MAX_OCCURRENCES_PER_EVENT; count++) {
      const next = expansion.next();
      if (!next || next.toJSDate() >= to) break;
      const details = event.getOccurrenceDetails(next);
      keep(details.item, details.startDate, details.endDate);
    }
  }
  return out;
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

// The Worker does not know the viewer's time zone, so all-day dates get a day of slack on each
// side. The client drops anything outside its own local range.
function overlaps(event: CalendarEvent, from: Date, to: Date): boolean {
  if (!event.allDay)
    return new Date(event.start) < to && new Date(event.end) > from;
  return (
    Date.parse(event.start) < +to + DAY_MS &&
    Date.parse(event.end) > +from - DAY_MS
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
