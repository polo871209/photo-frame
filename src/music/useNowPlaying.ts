import { useEffect, useRef, useState } from "preact/hooks";
import type { NowPlaying } from "../../shared/spotify";

const PLAYING_POLL_MS = 5_000;
const IDLE_POLL_MS = 15_000;
const TRACK_END_SLACK_MS = 800;
const AFTER_COMMAND_MS = 700;

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
        setState({ data, receivedAt: Date.now() });
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
