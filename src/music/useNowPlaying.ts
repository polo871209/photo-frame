import { useEffect, useRef, useState } from "preact/hooks";
import type { NowPlaying, Track } from "../../shared/spotify";

const PLAYING_POLL_MS = 5_000;
const IDLE_POLL_MS = 15_000;
const TRACK_END_SLACK_MS = 800;
const AFTER_COMMAND_MS = 700;
// Spotify's GET /me/player drops the track for a few seconds now and then, often at a track change.
const LIVE_GRACE_MS = 20_000;
const LAST_PLAYING_KEY = "frame.lastPlaying";

interface LastPlaying {
  track: Track;
  /** ISO instant of the last poll that saw `track` playing. */
  at: string;
}

export interface NowPlayingState {
  data?: NowPlaying;
  /** `Date.now()` when `data` arrived, to advance `progressMs` locally. */
  receivedAt: number;
  error?: string;
}

/** Polls `/api/spotify`. `refresh` polls again shortly, to show the result of a player command. */
export function useNowPlaying(): NowPlayingState & { refresh: () => void } {
  const [state, setState] = useState<NowPlayingState>({ receivedAt: 0 });
  const refresh = useRef(() => {});

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let generation = 0;
    let shown: NowPlaying | undefined;
    let liveLostAt: number | undefined;
    const schedule = (delay: number) => {
      clearTimeout(timer);
      const mine = ++generation;
      timer = setTimeout(() => poll(mine), delay);
    };
    const poll = async (mine: number) => {
      let delay = IDLE_POLL_MS;
      try {
        const response = await fetch("/api/spotify", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: NowPlaying = await response.json();
        if (mine !== generation) return;
        liveLostAt = isLive(data) ? undefined : (liveLostAt ?? Date.now());
        if (
          isLive(shown) &&
          liveLostAt !== undefined &&
          Date.now() - liveLostAt < LIVE_GRACE_MS
        ) {
          schedule(PLAYING_POLL_MS);
          return;
        }
        rememberPlaying(data);
        shown = withLastPlaying(data);
        setState({ data: shown, receivedAt: Date.now() });
        if (data.playing && data.track) {
          const left = data.track.durationMs - data.progressMs;
          delay = Math.max(
            1_000,
            Math.min(PLAYING_POLL_MS, left + TRACK_END_SLACK_MS),
          );
        }
      } catch (error) {
        if (controller.signal.aborted || mine !== generation) return;
        setState((previous) => ({
          ...previous,
          error: (error as Error).message,
        }));
      }
      schedule(delay);
    };
    refresh.current = () => schedule(AFTER_COMMAND_MS);
    schedule(0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  return { ...state, refresh: () => refresh.current() };
}

function isLive(data: NowPlaying | undefined): boolean {
  return !!data?.track && data.playedAt === null;
}

function rememberPlaying(data: NowPlaying): void {
  if (data.source !== "spotify" || !data.playing || !isLive(data)) return;
  const last: LastPlaying = {
    track: data.track!,
    at: new Date().toISOString(),
  };
  localStorage.setItem(LAST_PLAYING_KEY, JSON.stringify(last));
}

// Spotify's recently-played history misses some plays, for example those in a private session, so prefer a newer track this frame saw playing.
function withLastPlaying(data: NowPlaying): NowPlaying {
  if (isLive(data)) return data;
  const last = readLastPlaying();
  if (!last) return data;
  if (data.playedAt && Date.parse(data.playedAt) >= Date.parse(last.at)) {
    return data;
  }
  return {
    ...data,
    track: last.track,
    playing: false,
    progressMs: 0,
    device: null,
    playedAt: last.at,
  };
}

function readLastPlaying(): LastPlaying | undefined {
  try {
    const last: LastPlaying | null = JSON.parse(
      localStorage.getItem(LAST_PLAYING_KEY) ?? "null",
    );
    return last?.track && !Number.isNaN(Date.parse(last.at)) ? last : undefined;
  } catch {
    return undefined;
  }
}
