import type { CalendarInfo, EventsResponse } from "../shared/events";
import { expandIcs } from "./ics";
import { sampleEvents, SAMPLE_CALENDARS } from "./sample";

interface Env {
  /** JSON array of `{ "name", "url", "color" }`. `url` is a Google Calendar secret iCal address. */
  CALENDARS?: string;
}

interface CalendarConfig extends CalendarInfo {
  url: string;
}

const MAX_RANGE_DAYS = 70;
const ICS_CACHE_SECONDS = 300;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/api/events")
      return new Response("Not found", { status: 404 });

    const from = new Date(url.searchParams.get("from") ?? "");
    const to = new Date(url.searchParams.get("to") ?? "");
    if (
      Number.isNaN(+from) ||
      Number.isNaN(+to) ||
      to <= from ||
      +to - +from > MAX_RANGE_DAYS * 864e5
    ) {
      return Response.json(
        {
          error: `from and to must be ISO dates at most ${MAX_RANGE_DAYS} days apart`,
        },
        { status: 400 },
      );
    }

    const calendars = readCalendars(env);
    const body: EventsResponse = calendars.length
      ? await googleEvents(calendars, from, to)
      : {
          source: "sample",
          calendars: SAMPLE_CALENDARS,
          events: sampleEvents(from, to),
          failed: [],
        };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  },
} satisfies ExportedHandler<Env>;

function readCalendars(env: Env): CalendarConfig[] {
  if (!env.CALENDARS) return [];
  const parsed: unknown = JSON.parse(env.CALENDARS);
  if (!Array.isArray(parsed)) throw new Error("CALENDARS must be a JSON array");
  return parsed.map((entry: Partial<CalendarConfig>, index) => {
    if (
      typeof entry.url !== "string" ||
      typeof entry.name !== "string" ||
      typeof entry.color !== "string"
    ) {
      throw new Error(`CALENDARS[${index}] needs string name, url and color`);
    }
    return {
      id: `cal-${index}`,
      name: entry.name,
      color: entry.color,
      url: entry.url,
    };
  });
}

async function googleEvents(
  calendars: CalendarConfig[],
  from: Date,
  to: Date,
): Promise<EventsResponse> {
  const results = await Promise.all(
    calendars.map(async (calendar) => {
      try {
        const response = await fetch(calendar.url, {
          cf: { cacheTtl: ICS_CACHE_SECONDS, cacheEverything: true },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return expandIcs(await response.text(), calendar.id, from, to);
      } catch (error) {
        console.error(`calendar "${calendar.name}" failed:`, error);
        return null;
      }
    }),
  );
  return {
    source: "google",
    calendars: calendars.map(({ id, name, color }) => ({ id, name, color })),
    events: results.flatMap((events) => events ?? []),
    failed: calendars
      .filter((_, index) => results[index] === null)
      .map((calendar) => calendar.name),
  };
}
