import { findLyrics } from "./lyrics";
import {
  NEXT_UP_COUNT,
  SUGGESTION_COUNT,
  TOP_TRACK_COUNT,
  type Lyrics,
  type Suggestions,
  type NowPlaying,
  type PlayerCommand,
  type Suggestion,
  type Track,
} from "../shared/spotify";

export interface SpotifyCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface SpotifyImage {
  url: string;
  width: number | null;
}

interface SpotifyItem {
  uri: string;
  name: string;
  duration_ms: number;
  artists?: { name: string }[];
  album?: { uri: string; name: string; images: SpotifyImage[] };
  show?: { name: string };
  images?: SpotifyImage[];
}

interface PlaybackState {
  is_playing: boolean;
  progress_ms: number | null;
  device: { name: string } | null;
  item: SpotifyItem | null;
}

interface RecentlyPlayed {
  items: {
    track: SpotifyItem;
    played_at: string;
    context: { type: string; uri: string } | null;
  }[];
}

interface Queue {
  queue: (SpotifyItem | null)[];
}

const API = "https://api.spotify.com/v1";

const SUGGESTION_KINDS: readonly string[] = [
  "playlist",
  "album",
  "artist",
] satisfies Suggestion["kind"][];

const PLAY_PATH = "/me/player/play";

const COMMANDS = {
  pause: ["PUT", "/me/player/pause"],
  next: ["POST", "/me/player/next"],
  previous: ["POST", "/me/player/previous"],
} as const satisfies Record<
  Exclude<PlayerCommand["action"], "play" | "skipTo" | "playTracks">,
  [string, string]
>;

let cachedToken: { value: string; expiresAt: number } | undefined;

export async function handleSpotify(
  request: Request,
  path: string,
  credentials: SpotifyCredentials | null,
): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (path === "/api/spotify" && request.method === "GET") {
      const body = credentials
        ? await nowPlaying(credentials)
        : sampleNowPlaying();
      return Response.json(body, { headers });
    }
    if (path === "/api/spotify/suggestions" && request.method === "GET") {
      const body = credentials
        ? await suggestions(credentials)
        : sampleSuggestions();
      return Response.json(body, { headers });
    }
    if (path === "/api/spotify/lyrics" && request.method === "GET") {
      return await cachedLyrics(request, credentials);
    }
    if (path === "/api/spotify/control" && request.method === "POST") {
      const command = parseCommand(await request.json().catch(() => null));
      if (!command) {
        return Response.json(
          { error: "Unknown command" },
          { status: 400, headers },
        );
      }
      if (!credentials) {
        return Response.json(
          { error: "Spotify is not connected" },
          { status: 503, headers },
        );
      }
      await control(credentials, command);
      return new Response(null, { status: 204, headers });
    }
    return new Response("Not found", { status: 404, headers });
  } catch (error) {
    console.error(`${path} failed:`, error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Spotify failed" },
      { status: 502, headers },
    );
  }
}

async function nowPlaying(
  credentials: SpotifyCredentials,
): Promise<NowPlaying> {
  const token = await accessToken(credentials);
  const [state, queue] = await Promise.all([
    getJson<PlaybackState>("/me/player?additional_types=episode", token),
    getJson<Queue>("/me/player/queue", token),
  ]);
  const next = (queue?.queue ?? [])
    .filter((item) => item !== null)
    .slice(0, NEXT_UP_COUNT)
    .map(toTrack);
  if (state?.item) {
    return {
      source: "spotify",
      track: toTrack(state.item),
      playing: state.is_playing,
      progressMs: state.progress_ms ?? 0,
      device: state.device?.name ?? null,
      playedAt: null,
      next,
    };
  }
  const recent = await getJson<RecentlyPlayed>(
    "/me/player/recently-played?limit=1",
    token,
  );
  const last = recent?.items[0];
  return {
    source: "spotify",
    track: last ? toTrack(last.track) : null,
    playing: false,
    progressMs: 0,
    device: null,
    playedAt: last?.played_at ?? null,
    next,
  };
}

function sampleTrack(title: string, artists: string, minutes: number): Track {
  return {
    uri: `spotify:track:${title.toLowerCase()}`,
    title,
    artists,
    album: "Sample album",
    art: null,
    thumb: null,
    durationMs: minutes * 60_000,
  };
}

function sampleNowPlaying(): NowPlaying {
  const track = sampleTrack;
  const current = track("Rosewood", "Bonobo", 3);
  return {
    source: "sample",
    track: current,
    playing: true,
    progressMs: Date.now() % current.durationMs,
    device: "MacBook Pro",
    playedAt: null,
    next: [
      track("Otomo", "Bonobo, O'Flynn", 3.6),
      track("Shadows", "Nils Frahm", 4.2),
      track("Tides", "Little Simz", 4.85),
      track("Elysian", "Floating Points", 5.5),
    ],
  };
}

function sampleSuggestions(): Suggestions {
  return {
    jumpBackIn: [
      "Late night focus",
      "Sunday morning",
      "Running 2026",
      "Berlin nights",
    ].map((name, index) => ({
      uri: `spotify:playlist:sample${index}`,
      name,
      kind: "playlist",
      image: null,
    })),
    topTracks: [
      sampleTrack("Kerala", "Bonobo", 4),
      sampleTrack("Says", "Nils Frahm", 8.3),
      sampleTrack("Gorilla", "Little Simz", 3.2),
      sampleTrack("LesAlpx", "Floating Points", 5.1),
      sampleTrack("Open Eye Signal", "Jon Hopkins", 7.9),
      sampleTrack("Hold On", "Sault", 3.5),
    ],
  };
}

// LRCLIB rate-limits Cloudflare's shared egress addresses, so ask it once per track and colo.
async function cachedLyrics(
  request: Request,
  credentials: SpotifyCredentials | null,
): Promise<Response> {
  const key = new Request(request.url);
  const cached = await caches.default.match(key);
  const body: Lyrics = cached
    ? await cached.json()
    : credentials
      ? await lyrics(
          credentials,
          new URL(request.url).searchParams.get("uri") ?? "",
        )
      : sampleLyrics();
  if (!cached && credentials) {
    await caches.default.put(
      key,
      Response.json(body, { headers: { "Cache-Control": "max-age=604800" } }),
    );
  }
  return Response.json(body, {
    headers: { "Cache-Control": "private, max-age=86400" },
  });
}

async function lyrics(
  credentials: SpotifyCredentials,
  uri: string,
): Promise<Lyrics> {
  if (!uri.startsWith("spotify:track:")) return { kind: "none" };
  const token = await accessToken(credentials);
  const track = await getJson<SpotifyItem>(
    `/tracks/${uri.split(":").at(-1)}`,
    token,
  );
  if (!track) return { kind: "none" };
  return findLyrics({
    title: track.name,
    artist: track.artists?.[0]?.name ?? "",
    album: track.album?.name ?? "",
    durationMs: track.duration_ms,
  });
}

function sampleLyrics(): Lyrics {
  const words = [
    "Sample lyrics for the sample track",
    "Each line lights up in time",
    "",
    "Connect Spotify to see the real ones",
  ];
  return {
    kind: "synced",
    lines: words.map((text, index) => ({ timeMs: index * 6_000, text })),
  };
}

async function suggestions(
  credentials: SpotifyCredentials,
): Promise<Suggestions> {
  const token = await accessToken(credentials);
  const [jumpBackIn, top] = await Promise.all([
    recentContexts(token),
    getJson<{ items: SpotifyItem[] }>(
      `/me/top/tracks?time_range=short_term&limit=${TOP_TRACK_COUNT}`,
      token,
    ),
  ]);
  return { jumpBackIn, topTracks: (top?.items ?? []).map(toTrack) };
}

async function recentContexts(token: string): Promise<Suggestion[]> {
  const recent = await getJson<RecentlyPlayed>(
    "/me/player/recently-played?limit=50",
    token,
  );
  const contexts = new Map<string, Suggestion>();
  const albums = new Map<string, Suggestion>();
  for (const { context, track } of recent?.items ?? []) {
    const image = pickImage(track.album?.images ?? [], 160);
    if (
      context &&
      SUGGESTION_KINDS.includes(context.type) &&
      !contexts.has(context.uri)
    ) {
      contexts.set(context.uri, {
        uri: context.uri,
        name: "Spotify mix",
        kind: context.type as Suggestion["kind"],
        image,
      });
    }
    if (track.album && !albums.has(track.album.uri)) {
      albums.set(track.album.uri, {
        uri: track.album.uri,
        name: track.album.name,
        kind: "album",
        image,
      });
    }
  }
  // Spotify answers 404 for the metadata of its own mixes in Development Mode, so those keep the name "Spotify mix".
  const described = await Promise.all(
    [...contexts.values()]
      .slice(0, SUGGESTION_COUNT)
      .map((context) =>
        describe(context.uri, context.kind, token).catch(() => context),
      ),
  );
  const shown = new Set(described.map((suggestion) => suggestion.uri));
  return [
    ...described,
    ...[...albums.values()].filter((album) => !shown.has(album.uri)),
  ].slice(0, SUGGESTION_COUNT);
}

async function describe(
  uri: string,
  kind: Suggestion["kind"],
  token: string,
): Promise<Suggestion> {
  const id = uri.split(":").at(-1);
  const query = kind === "playlist" ? "?fields=name,images" : "";
  const body = await getJson<{ name: string; images: SpotifyImage[] | null }>(
    `/${kind}s/${id}${query}`,
    token,
  );
  if (!body) throw new Error(`Spotify ${kind} ${id} has no body`);
  return {
    uri,
    name: body.name,
    kind,
    image: pickImage(body.images ?? [], 160),
  };
}

async function control(
  credentials: SpotifyCredentials,
  command: PlayerCommand,
): Promise<void> {
  const token = await accessToken(credentials);
  switch (command.action) {
    case "skipTo":
      return skipTo(command.uri, token);
    case "playTracks":
      return playTracks(command.uris, command.offset, token);
    case "play":
      await play(token, command.uri ? { context_uri: command.uri } : undefined);
      return;
    default: {
      const [method, path] = COMMANDS[command.action];
      const response = await send(method, path, token);
      if (!response.ok)
        throw new Error(`Spotify ${path} HTTP ${response.status}`);
    }
  }
}

async function play(
  token: string,
  body: object | undefined,
): Promise<string | undefined> {
  const json = body && JSON.stringify(body);
  let response = await send("PUT", PLAY_PATH, token, json);
  let deviceId: string | undefined;
  // Spotify answers 404 to a play command when no device is active, so wake the first device that can play.
  if (response.status === 404) {
    const devices = await getJson<{
      devices: { id: string | null; is_restricted: boolean }[];
    }>("/me/player/devices", token);
    deviceId =
      devices?.devices.find((d) => d.id && !d.is_restricted)?.id ?? undefined;
    if (!deviceId) throw new Error("No Spotify device is open");
    response = await send(
      "PUT",
      `${PLAY_PATH}?device_id=${encodeURIComponent(deviceId)}`,
      token,
      json,
    );
  }
  if (!response.ok)
    throw new Error(`Spotify ${PLAY_PATH} HTTP ${response.status}`);
  return deviceId;
}

// The desktop app stops playback on a play command with a bare `uris` list, so play the track in its album and queue the rest: https://community.spotify.com/forum/en/discussion/7552922
async function playTracks(
  uris: string[],
  offset: number,
  token: string,
): Promise<void> {
  const picked = uris[offset]!;
  const track = await getJson<SpotifyItem>(
    `/tracks/${picked.split(":").at(-1)}`,
    token,
  );
  if (!track?.album) throw new Error("That track has no album");
  const deviceId = await play(token, {
    context_uri: track.album.uri,
    offset: { uri: picked },
  });
  const device = deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : "";
  for (const uri of uris.slice(offset + 1)) {
    const path = `/me/player/queue?uri=${encodeURIComponent(uri)}${device}`;
    const response = await send("POST", path, token);
    if (!response.ok)
      throw new Error(`Spotify /me/player/queue HTTP ${response.status}`);
  }
}

async function skipTo(uri: string, token: string): Promise<void> {
  const queue = await getJson<Queue>("/me/player/queue", token);
  const index = queue?.queue.findIndex((item) => item?.uri === uri) ?? -1;
  if (index < 0) throw new Error("That track is no longer in the queue");
  const [method, path] = COMMANDS.next;
  // The Web API has no command to jump into the queue, so skip one track at a time.
  for (let skipped = 0; skipped <= index; skipped++) {
    const response = await send(method, path, token);
    if (!response.ok)
      throw new Error(`Spotify ${path} HTTP ${response.status}`);
  }
}

function parseCommand(value: unknown): PlayerCommand | null {
  if (typeof value !== "object" || value === null) return null;
  const { action, uri, uris, offset } = value as {
    action?: unknown;
    uri?: unknown;
    uris?: unknown;
    offset?: unknown;
  };
  if (action === "pause" || action === "next" || action === "previous") {
    return { action };
  }
  if (action === "playTracks") {
    const valid =
      Array.isArray(uris) &&
      uris.length <= TOP_TRACK_COUNT &&
      uris.every((item) => isSpotifyUri(item)) &&
      Number.isInteger(offset) &&
      (offset as number) >= 0 &&
      (offset as number) < uris.length;
    return valid ? { action, uris, offset: offset as number } : null;
  }
  const validUri = isSpotifyUri(uri);
  if (action === "skipTo") return validUri ? { action, uri } : null;
  if (action !== "play") return null;
  if (uri === undefined) return { action };
  return validUri ? { action, uri } : null;
}

function isSpotifyUri(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("spotify:");
}

async function accessToken(credentials: SpotifyCredentials): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt)
    return cachedToken.value;
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
    }),
  });
  if (!response.ok) throw new Error(`Spotify token HTTP ${response.status}`);
  const body: { access_token: string; expires_in: number } =
    await response.json();
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in - 60) * 1000,
  };
  return body.access_token;
}

async function send(
  method: string,
  path: string,
  token: string,
  body?: string,
): Promise<Response> {
  const response = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body && { "Content-Type": "application/json" }),
    },
    body,
  });
  if (response.status === 401) cachedToken = undefined;
  return response;
}

async function getJson<T>(path: string, token: string): Promise<T | null> {
  const response = await send("GET", path, token);
  if (!response.ok) throw new Error(`Spotify ${path} HTTP ${response.status}`);
  // Spotify answers 204 with no body when no device is active.
  if (response.status === 204) return null;
  return response.json();
}

function toTrack(item: SpotifyItem): Track {
  const images = item.album?.images ?? item.images ?? [];
  return {
    uri: item.uri,
    title: item.name,
    artists:
      item.artists?.map((artist) => artist.name).join(", ") ??
      item.show?.name ??
      "",
    album: item.album?.name ?? "",
    art: pickImage(images, 600),
    thumb: pickImage(images, 64),
    durationMs: item.duration_ms,
  };
}

function pickImage(images: SpotifyImage[], minWidth: number): string | null {
  const byWidth = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (
    (byWidth.find((image) => (image.width ?? 0) >= minWidth) ?? byWidth.at(-1))
      ?.url ?? null
  );
}
