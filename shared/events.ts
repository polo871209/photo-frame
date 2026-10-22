/** One calendar as configured on the server. The ICS address never leaves the Worker. */
export interface CalendarInfo {
  id: string;
  name: string;
  color: string;
}

/**
 * One occurrence of an event. Timed events carry ISO 8601 instants. All-day events carry
 * `YYYY-MM-DD` dates, with `end` exclusive, as in iCalendar.
 */
export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  allDay: boolean;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export interface EventsResponse {
  source: "google" | "sample";
  calendars: CalendarInfo[];
  events: CalendarEvent[];
  /** Names of calendars whose feed could not be read. Their events are missing. */
  failed: string[];
}
