import type { Lyrics } from "../shared/spotify";

const LRCLIB = "https://lrclib.net/api";
const DURATION_SLACK_S = 5;
const OVERLOAD_RETRIES = 2;
const LRC_TIME = /\[(\d+):(\d+(?:\.\d+)?)\]/g;

interface LrclibRecord {
  duration: number | null;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface LyricsQuery {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
}

export async function findLyrics(query: LyricsQuery): Promise<Lyrics> {
  const seconds = Math.round(query.durationMs / 1000);
  const exact = await lrclib<LrclibRecord>(
    `/get?${new URLSearchParams({
      track_name: query.title,
      artist_name: query.artist,
      album_name: query.album,
      duration: String(seconds),
    })}`,
  );
  const record =
    exact ??
    bestMatch(
      (await lrclib<LrclibRecord[]>(
        `/search?${new URLSearchParams({
          track_name: query.title,
          artist_name: query.artist,
        })}`,
      )) ?? [],
      seconds,
    );
  return record ? toLyrics(record) : { kind: "none" };
}

async function lrclib<T>(path: string): Promise<T | null> {
  let response = await lrclibFetch(path);
  // LRCLIB answers 503 "ServerOverloaded" and 429 now and then, and a retry a moment later usually works.
  for (
    let retry = 1;
    (response.status === 503 || response.status === 429) &&
    retry <= OVERLOAD_RETRIES;
    retry++
  ) {
    await new Promise((resolve) => setTimeout(resolve, retry * 400));
    response = await lrclibFetch(path);
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`LRCLIB HTTP ${response.status}`);
  return response.json();
}

function lrclibFetch(path: string): Promise<Response> {
  return fetch(LRCLIB + path, {
    // LRCLIB asks every client to name itself in the User-Agent.
    headers: {
      "User-Agent":
        "frame-dashboard (https://github.com/polo871209/photo-frame)",
    },
  });
}

function bestMatch(
  records: LrclibRecord[],
  seconds: number,
): LrclibRecord | undefined {
  const near = records
    .map((record) => ({
      record,
      off: Math.abs((record.duration ?? seconds) - seconds),
    }))
    .filter(({ off }) => off <= DURATION_SLACK_S)
    .sort((a, b) => a.off - b.off)
    .map(({ record }) => record);
  return (
    near.find((record) => record.syncedLyrics) ??
    near.find((record) => record.plainLyrics || record.instrumental)
  );
}

function toLyrics(record: LrclibRecord): Lyrics {
  if (record.instrumental) return { kind: "instrumental" };
  const synced = record.syncedLyrics ? parseLrc(record.syncedLyrics) : [];
  if (synced.length) return { kind: "synced", lines: synced };
  if (record.plainLyrics) {
    return { kind: "plain", lines: record.plainLyrics.split("\n") };
  }
  return { kind: "none" };
}

function parseLrc(text: string): { timeMs: number; text: string }[] {
  const lines: { timeMs: number; text: string }[] = [];
  for (const row of text.split("\n")) {
    const words = row.replace(LRC_TIME, "").trim();
    for (const [, minutes, seconds] of row.matchAll(LRC_TIME)) {
      lines.push({
        timeMs: Math.round((Number(minutes) * 60 + Number(seconds)) * 1000),
        text: words,
      });
    }
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}
