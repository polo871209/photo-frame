import type { CalendarEvent, CalendarInfo } from "../shared/events";

export const SAMPLE_CALENDARS: CalendarInfo[] = [
  { id: "family", name: "Family", color: "#D8321F" },
  { id: "work", name: "Work", color: "#2F5FD0" },
  { id: "school", name: "School", color: "#00875A" },
  { id: "holidays", name: "Holidays", color: "#C26A00" },
];

interface Template {
  calendarId: string;
  title: string;
  weekdays: number[];
  startHour: number;
  hours: number;
  location?: string;
}

const TEMPLATES: Template[] = [
  {
    calendarId: "work",
    title: "Team stand-up",
    weekdays: [1, 2, 3, 4, 5],
    startHour: 9.5,
    hours: 0.25,
  },
  {
    calendarId: "work",
    title: "Design review",
    weekdays: [2, 4],
    startHour: 11,
    hours: 1.5,
    location: "Room 4B",
  },
  {
    calendarId: "work",
    title: "1:1 with Aisha",
    weekdays: [3],
    startHour: 14,
    hours: 0.5,
  },
  {
    calendarId: "work",
    title: "Quarterly planning",
    weekdays: [1],
    startHour: 13,
    hours: 2,
  },
  {
    calendarId: "school",
    title: "School run",
    weekdays: [1, 2, 3, 4, 5],
    startHour: 7.25,
    hours: 0.5,
  },
  {
    calendarId: "school",
    title: "Swim class",
    weekdays: [2, 5],
    startHour: 16.5,
    hours: 1,
    location: "Aquatic Centre",
  },
  {
    calendarId: "school",
    title: "Piano lesson",
    weekdays: [3],
    startHour: 17,
    hours: 0.75,
  },
  {
    calendarId: "family",
    title: "Family dinner",
    weekdays: [0],
    startHour: 18.5,
    hours: 2,
    location: "Grandma's",
  },
  {
    calendarId: "family",
    title: "Grocery run",
    weekdays: [6],
    startHour: 10,
    hours: 1,
  },
  {
    calendarId: "family",
    title: "Park + picnic",
    weekdays: [6],
    startHour: 15,
    hours: 2.5,
    location: "Botanic Gardens",
  },
  {
    calendarId: "family",
    title: "Yoga",
    weekdays: [1, 3],
    startHour: 19,
    hours: 1,
  },
];

const DAY_MS = 864e5;

/**
 * Builds sample events for `[from, to)`. `from` is the client's local midnight, so hour offsets
 * from it land on local clock times.
 */
export function sampleEvents(from: Date, to: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let dayStart = +from; dayStart < +to; dayStart += DAY_MS) {
    const midday = dayStart + 12 * 36e5;
    const weekday = new Date(midday).getUTCDay();
    for (const template of TEMPLATES) {
      if (!template.weekdays.includes(weekday)) continue;
      const start = dayStart + template.startHour * 36e5;
      events.push({
        id: `sample:${template.title}:${dayStart}`,
        calendarId: template.calendarId,
        title: template.title,
        allDay: false,
        start: new Date(start).toISOString(),
        end: new Date(start + template.hours * 36e5).toISOString(),
        location: template.location,
      });
    }
    if (Math.floor(midday / DAY_MS) % 9 === 0) {
      const date = isoDate(midday);
      events.push({
        id: `sample:holiday:${date}`,
        calendarId: "holidays",
        title: "Public holiday",
        allDay: true,
        start: date,
        end: isoDate(dayStart + 36 * 36e5),
      });
    }
  }
  return events;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
