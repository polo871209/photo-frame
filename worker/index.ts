import { parseCommand } from "../shared/control";
import type { CalendarInfo, EventsResponse } from "../shared/events";
import type { FrameControl } from "./control";
import { expandIcs } from "./ics";
import { sampleEvents, SAMPLE_CALENDARS } from "./sample";
import { handleSpotify, type SpotifyCredentials } from "./spotify";

export { FrameControl } from "./control";

interface Env {
  ASSETS: Fetcher;
  FRAME_CONTROL: DurableObjectNamespace<FrameControl>;
  /** JSON array of `{ "name", "url", "color" }`. `url` is a Google Calendar secret iCal address. */
  CALENDARS?: string;
  /** The Spotify app that `pnpm spotify-login` signed in with, and the refresh token it got. If any is unset, `/api/spotify` returns a sample track. */
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  SPOTIFY_REFRESH_TOKEN?: string;
}

interface CalendarConfig extends CalendarInfo {
  url: string;
}

const MAX_RANGE_DAYS = 70;

export default {
  async fetch(request, env): Promise<Response> {
    if (!import.meta.env.DEV && !hasClientCertificate(request)) {
      return notFound();
    }
    const url = new URL(request.url);
    return url.pathname.startsWith("/api/")
      ? handleApi(request, url, env)
      : serveAsset(request, url, env);
  },
} satisfies ExportedHandler<Env>;

function hasClientCertificate(
  request: Request<unknown, IncomingRequestCfProperties>,
): boolean {
  const auth = request.cf?.tlsClientAuth;
  return auth?.certVerified === "SUCCESS" && auth.certRevoked === "0";
}

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

async function handleApi(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  if (url.pathname.startsWith("/api/spotify")) {
    return handleSpotify(request, url.pathname, spotifyCredentials(env));
  }
  if (url.pathname === "/api/control") return handleControl(request, env);
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
    headers: { "Cache-Control": "no-store" },
  });
}

async function handleControl(request: Request, env: Env): Promise<Response> {
  const control = env.FRAME_CONTROL.getByName("frame");
  if (request.headers.get("Upgrade") === "websocket") return control.fetch(request);
  if (request.method === "GET") return noStore(await control.status());
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const command = parseCommand(await request.json().catch(() => undefined));
  if (!command) {
    return Response.json(
      { error: 'expected {"type":"screen","on":boolean}, {"type":"show","screen":"calendar"|"music"} or {"type":"reload"}' },
      { status: 400 },
    );
  }
  return noStore(await control.command(command));
}

function noStore(body: unknown): Response {
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}

function spotifyCredentials(env: Env): SpotifyCredentials | null {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } =
    env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
    return null;
  }
  return {
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
    refreshToken: SPOTIFY_REFRESH_TOKEN,
  };
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
