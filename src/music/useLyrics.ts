import { useEffect, useState } from "preact/hooks";
import type { Lyrics } from "../../shared/spotify";

const RETRY_MS = 15_000;

export type LyricsState = Lyrics | { kind: "loading" } | { kind: "error" };

/** Fetches the lyrics of `uri` while `enabled`, and retries a failed fetch every 15 s. */
export function useLyrics(
  uri: string | undefined,
  enabled: boolean,
): LyricsState {
  const [state, setState] = useState<LyricsState>({ kind: "loading" });

  useEffect(() => {
    if (!uri || !enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = () =>
      fetch(`/api/spotify/lyrics?uri=${encodeURIComponent(uri)}`, {
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json() as Promise<Lyrics>;
        })
        .then(setState, () => {
          if (controller.signal.aborted) return;
          setState({ kind: "error" });
          timer = setTimeout(load, RETRY_MS);
        });
    setState({ kind: "loading" });
    load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [uri, enabled]);

  return state;
}
