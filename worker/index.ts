import { BUILD_HEADER, BUILD_ID } from "../shared/build";
import type { CalendarInfo, EventsResponse } from "../shared/events";
import { expandIcs } from "./ics";
import { sampleEvents, SAMPLE_CALENDARS } from "./sample";

interface Env {
  ASSETS: Fetcher;
  /** JSON array of `{ "name", "url", "color" }`. `url` is a Google Calendar secret iCal address. */
  CALENDARS?: string;
  /** Shared secret. Every request must send it as `?key=` or in the `frame_key` cookie, or it gets 404. */
  FRAME_KEY?: string;
}

interface CalendarConfig extends CalendarInfo {
  url: string;
}

const MAX_RANGE_DAYS = 70;
const KEY_COOKIE = "frame_key";
const COOKIE_MAX_AGE_SECONDS = 400 * 86400;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const queryKey = url.searchParams.get("key");
    const sentKey = queryKey ?? readCookie(request, KEY_COOKIE) ?? "";
    if (!(await isFrameKey(sentKey, env))) return notFound();

    const response = url.pathname.startsWith("/api/")
      ? await handleApi(url, env)
      : await serveAsset(request, url, env);
    if (queryKey === null) return response;

    const withCookie = new Response(response.body, response);
    withCookie.headers.append(
      "Set-Cookie",
      `${KEY_COOKIE}=${queryKey}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Strict`,
    );
    return withCookie;
  },
} satisfies ExportedHandler<Env>;

async function serveAsset(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  const hashed = url.pathname.startsWith("/assets/");
  // A 304 replaces the cached headers (RFC 9111 section 4.3.4), so files cached before stop revalidating too.
  if (!hashed || ![200, 304].includes(response.status)) return response;
  const immutable = new Response(response.body, response);
  immutable.headers.set(
    "Cache-Control",
    "private, max-age=31536000, immutable",
  );
  return immutable;
}

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

function readCookie(request: Request, name: string): string | undefined {
  return request.headers
    .get("Cookie")
    ?.split(";")
    .map((pair) => pair.trim().split("="))
    .find(([key]) => key === name)?.[1];
}

async function isFrameKey(sentKey: string, env: Env): Promise<boolean> {
  if (!env.FRAME_KEY) return false;
  return crypto.subtle.timingSafeEqual(
    await sha256(sentKey),
    await sha256(env.FRAME_KEY),
  );
}

function sha256(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

async function handleApi(url: URL, env: Env): Promise<Response> {
  if (url.pathname !== "/api/events") return notFound();

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
  return Response.json(body, {
    headers: { "Cache-Control": "no-store", [BUILD_HEADER]: BUILD_ID },
  });
}

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
          cf: { cacheTtl: 30, cacheEverything: true },
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
