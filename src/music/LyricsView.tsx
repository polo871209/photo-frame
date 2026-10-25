import { useEffect, useRef } from "preact/hooks";
import type { LyricsState } from "./useLyrics";

const LEAD_MS = 400;
const MANUAL_SCROLL_MS = 6_000;

const NOTES: Record<
  Exclude<LyricsState["kind"], "synced" | "plain">,
  string
> = {
  loading: "Loading lyrics…",
  error: "Lyrics not loaded. Retrying…",
  instrumental: "Instrumental",
  none: "No lyrics for this song",
};

/** `positionMs` is `null` when the track is not live, so no line is lit. */
export function LyricsView({
  lyrics,
  positionMs,
}: {
  lyrics: LyricsState;
  positionMs: number | null;
}) {
  const list = useRef<HTMLOListElement>(null);
  const touchedAt = useRef(0);
  const active =
    lyrics.kind === "synced" && positionMs !== null
      ? lastStarted(lyrics.lines, positionMs + LEAD_MS)
      : -1;

  useEffect(() => {
    list.current?.scrollTo({ top: 0 });
  }, [lyrics]);

  useEffect(() => {
    const element = list.current;
    const line = element?.children[active] as HTMLElement | undefined;
    if (!element || !line) return;
    if (Date.now() - touchedAt.current < MANUAL_SCROLL_MS) return;
    element.scrollTo({
      top: line.offsetTop - element.clientHeight / 3,
      behavior: "smooth",
    });
  }, [active]);

  if (lyrics.kind !== "synced" && lyrics.kind !== "plain") {
    return <p class="music-lyrics-note">{NOTES[lyrics.kind]}</p>;
  }
  const lines =
    lyrics.kind === "synced"
      ? lyrics.lines.map(({ text }) => text)
      : lyrics.lines;
  return (
    <ol
      ref={list}
      class={`music-lyrics${active < 0 ? " is-static" : ""}`}
      onPointerDown={() => (touchedAt.current = Date.now())}
    >
      {lines.map((text, index) => (
        <li
          key={index}
          class={index === active ? "is-now" : index < active ? "is-past" : ""}
        >
          {text || (lyrics.kind === "synced" ? "♪" : "\u00a0")}
        </li>
      ))}
    </ol>
  );
}

function lastStarted(lines: { timeMs: number }[], positionMs: number): number {
  let index = -1;
  while (index + 1 < lines.length && lines[index + 1]!.timeMs <= positionMs)
    index++;
  return index;
}
