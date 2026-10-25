import { useEffect, useRef, useState } from "preact/hooks";
import type { LyricsState } from "./useLyrics";

const LEAD_MS = 250;
const MANUAL_SCROLL_MS = 6_000;
const SCROLL_MS = 450;

const NOTES: Record<
  Exclude<LyricsState["kind"], "synced" | "plain">,
  string
> = {
  loading: "Loading lyrics…",
  error: "Lyrics not loaded. Retrying…",
  instrumental: "Instrumental",
  none: "No lyrics for this song",
};

/** Where the track stands: at `progressMs` at the `Date.now()` instant `at`, and moving if `playing`. */
export interface Playhead {
  progressMs: number;
  at: number;
  playing: boolean;
}

/** `playhead` is `null` when the track is not live, so no line is lit. */
export function LyricsView({
  lyrics,
  playhead,
}: {
  lyrics: LyricsState;
  playhead: Playhead | null;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const touchedAt = useRef(0);
  const active = useActiveLine(lyrics, playhead);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [lyrics]);

  useEffect(() => {
    const view = scroller.current;
    const content = list.current;
    const line = content?.children[active] as HTMLElement | undefined;
    if (!view || !content || !line) return;
    if (Date.now() - touchedAt.current < MANUAL_SCROLL_MS) return;
    glideTo(view, content, line.offsetTop - view.clientHeight / 3);
  }, [active]);

  if (lyrics.kind !== "synced" && lyrics.kind !== "plain") {
    return <p class="music-lyrics-note">{NOTES[lyrics.kind]}</p>;
  }
  const lines =
    lyrics.kind === "synced"
      ? lyrics.lines.map(({ text }) => text)
      : lyrics.lines;
  return (
    <div class="music-lyrics">
      <div
        ref={scroller}
        class="music-lyrics-scroll"
        onPointerDown={() => (touchedAt.current = Date.now())}
      >
        <ol ref={list} class={active < 0 ? "is-static" : ""}>
          {lines.map((text, index) => (
            <li
              key={index}
              class={
                index === active ? "is-now" : index < active ? "is-past" : ""
              }
            >
              {text || (lyrics.kind === "synced" ? "♪" : "\u00a0")}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Returns the lit line, and renders again when the next line starts. */
function useActiveLine(lyrics: LyricsState, playhead: Playhead | null): number {
  const [, wake] = useState(0);
  const lines = lyrics.kind === "synced" ? lyrics.lines : null;
  const position =
    lines && playhead
      ? playhead.progressMs +
        (playhead.playing ? Date.now() - playhead.at : 0) +
        LEAD_MS
      : null;
  const active = position === null ? -1 : lastStarted(lines!, position);
  const nextStart = lines?.[active + 1]?.timeMs;

  useEffect(() => {
    if (!playhead?.playing || position === null || nextStart === undefined)
      return;
    const timer = setTimeout(
      () => wake((n) => n + 1),
      Math.max(0, nextStart - position),
    );
    return () => clearTimeout(timer);
  });

  return active;
}

/** Jumps `view` to `top` at once, then slides `content` there with a transform, which the compositor animates off the main thread. */
function glideTo(view: HTMLElement, content: HTMLElement, top: number): void {
  const offset = new DOMMatrix(getComputedStyle(content).transform).m42;
  for (const animation of content.getAnimations()) animation.cancel();
  const from = view.scrollTop;
  view.scrollTop = top;
  const shift = view.scrollTop - from + offset;
  if (!shift) return;
  content.animate(
    [{ transform: `translateY(${shift}px)` }, { transform: "none" }],
    { duration: SCROLL_MS, easing: "cubic-bezier(.25, .8, .25, 1)" },
  );
}

function lastStarted(lines: { timeMs: number }[], positionMs: number): number {
  let index = -1;
  while (index + 1 < lines.length && lines[index + 1]!.timeMs <= positionMs)
    index++;
  return index;
}
