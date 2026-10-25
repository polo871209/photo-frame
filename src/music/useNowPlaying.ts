import { useEffect, useRef, useState } from "preact/hooks";
import type { NowPlaying, PlayerCommand, Track } from "../../shared/spotify";

const PLAYING_POLL_MS = 5_000;
const IDLE_POLL_MS = 15_000;
const TRACK_END_SLACK_MS = 800;
const AFTER_COMMAND_MS = 700;
// Spotify takes a few seconds to wake an inactive device, so poll fast after a command until the player shows its result.
const SETTLE_POLL_MS = 1_500;
const SETTLE_MAX_MS = 15_000;
// Spotify's GET /me/player drops the track for a few seconds now and then, often at a track change.
const LIVE_GRACE_MS = 20_000;
const LAST_PLAYING_KEY = "frame.lastPlaying";
const CLOCK_TOLERANCE_MS = 1_000;

interface LastPlaying {
  track: Track;
  at: string;
}

export interface NowPlayingState {
  data?: NowPlaying;
  receivedAt: number;
  error?: string;
}

export function useNowPlaying(): NowPlayingState & {
  refresh: (command: PlayerCommand) => void;
} {
  const [state, setState] = useState<NowPlayingState>({ receivedAt: 0 });
  const refresh = useRef((_command: PlayerCommand) => {});

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let generation = 0;
    let shown: NowPlaying | undefined;
    let liveLostAt: number | undefined;
    let clock = { at: 0, roundTripMs: Infinity };
    let latest: string | undefined;
    let settle:
      | { before: string | undefined; playing: boolean; until: number }
      | undefined;
    const schedule = (delay: number) => {
      clearTimeout(timer);
      const mine = ++generation;
      timer = setTimeout(() => poll(mine), delay);
    };
    const poll = async (mine: number) => {
      let delay = IDLE_POLL_MS;
      const sentAt = Date.now();
      try {
        const response = await fetch("/api/spotify", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: NowPlaying = await response.json();
        if (mine !== generation) return;
        latest = playerKey(data);
        if (
          settle &&
          latest !== settle.before &&
          data.playing === settle.playing
        ) {
          settle = undefined;
        }
        delay = show(data, sentAt, Date.now());
      } catch (error) {
        if (controller.signal.aborted || mine !== generation) return;
        setState((previous) => ({
          ...previous,
          error: (error as Error).message,
        }));
      }
      if (settle && Date.now() < settle.until) {
        delay = Math.min(delay, SETTLE_POLL_MS);
      }
      schedule(delay);
    };
    const show = (
      data: NowPlaying,
      sentAt: number,
      receivedAt: number,
    ): number => {
      liveLostAt = isLive(data) ? undefined : (liveLostAt ?? Date.now());
      if (
        isLive(shown) &&
        liveLostAt !== undefined &&
        Date.now() - liveLostAt < LIVE_GRACE_MS
      ) {
        return PLAYING_POLL_MS;
      }
      rememberPlaying(data);
      const next = withLastPlaying(data);
      const reading = {
        at: (sentAt + receivedAt) / 2,
        roundTripMs: receivedAt - sentAt,
      };
      const expected = shown && shown.progressMs + (reading.at - clock.at);
      const keepClock =
        sameTrackPlaying(shown, next) &&
        reading.roundTripMs >= clock.roundTripMs &&
        Math.abs(expected! - next.progressMs) < CLOCK_TOLERANCE_MS;
      if (keepClock) {
        shown = { ...next, progressMs: shown!.progressMs };
      } else {
        shown = next;
        clock = reading;
      }
      setState({ data: shown, receivedAt: clock.at });
      if (!data.playing || !data.track) return IDLE_POLL_MS;
      const left = data.track.durationMs - data.progressMs;
      return Math.max(
        1_000,
        Math.min(PLAYING_POLL_MS, left + TRACK_END_SLACK_MS),
      );
    };
    refresh.current = (command) => {
      settle = {
        before: latest,
        playing: command.action !== "pause",
        until: Date.now() + SETTLE_MAX_MS,
      };
      schedule(AFTER_COMMAND_MS);
    };
    schedule(0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  return { ...state, refresh: (command) => refresh.current(command) };
}

function playerKey(data: NowPlaying): string {
  return [data.track?.uri, data.playing, data.playedAt].join("|");
}

function sameTrackPlaying(
  before: NowPlaying | undefined,
  after: NowPlaying,
): boolean {
  return (
    !!before?.playing &&
    after.playing &&
    isLive(before) &&
    isLive(after) &&
    before.track!.uri === after.track!.uri
  );
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
