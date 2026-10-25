import { useEffect, useRef } from "preact/hooks";
import { playChime } from "../lib/chime";
import type { Occurrence } from "./model";

const LEAD_MS = 5 * 60_000;

/** Chimes once when a timed event is at most 5 min away. */
export function useChimes(
  occurrences: Occurrence[],
  now: Date,
  enabled: boolean,
) {
  const chimed = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled) return;
    const due = occurrences.filter((occurrence) => {
      const untilStart = +occurrence.start - +now;
      return !occurrence.allDay && untilStart > 0 && untilStart <= LEAD_MS;
    });
    const fresh = due
      .map((occurrence) => `${occurrence.id}@${+occurrence.start}`)
      .filter((key) => !chimed.current.has(key));
    if (!fresh.length) return;
    for (const key of fresh) chimed.current.add(key);
    playChime();
  }, [occurrences, +now, enabled]);
}
