import { useState } from "preact/hooks";
import type { Occurrence } from "./model";

export interface CalendarPrefs {
  hidden: string[];
  colors: Record<string, string>;
}

export const WHITE_TEXT_COLORS = [
  "#D50000",
  "#F4511E",
  "#E67C73",
  "#0B8043",
  "#33B679",
  "#039BE5",
  "#3F51B5",
  "#8E24AA",
  "#616161",
];

const STORAGE_KEY = "frame.calendar-prefs";

export function useCalendarPrefs(): [
  CalendarPrefs,
  (prefs: CalendarPrefs) => void,
] {
  const [prefs, setPrefs] = useState(loadPrefs);
  const save = (next: CalendarPrefs) => {
    setPrefs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };
  return [prefs, save];
}

function loadPrefs(): CalendarPrefs {
  try {
    const stored: Partial<CalendarPrefs> | null = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    );
    return {
      hidden: Array.isArray(stored?.hidden) ? stored.hidden : [],
      colors:
        stored?.colors && typeof stored.colors === "object"
          ? stored.colors
          : {},
    };
  } catch {
    return { hidden: [], colors: {} };
  }
}

export function toggleHidden(
  prefs: CalendarPrefs,
  name: string,
): CalendarPrefs {
  const hidden = prefs.hidden.includes(name)
    ? prefs.hidden.filter((hiddenName) => hiddenName !== name)
    : [...prefs.hidden, name];
  return { ...prefs, hidden };
}

export function setColor(
  prefs: CalendarPrefs,
  name: string,
  color: string | undefined,
): CalendarPrefs {
  const { [name]: _previous, ...colors } = prefs.colors;
  return { ...prefs, colors: color ? { ...colors, [name]: color } : colors };
}

export function withPrefs(
  occurrences: Occurrence[],
  prefs: CalendarPrefs,
): Occurrence[] {
  return occurrences
    .filter((occurrence) => !prefs.hidden.includes(occurrence.calendar.name))
    .map((occurrence) => {
      const color = prefs.colors[occurrence.calendar.name];
      return color
        ? { ...occurrence, calendar: { ...occurrence.calendar, color } }
        : occurrence;
    });
}
