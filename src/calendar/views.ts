import {
  addDays,
  addMonths,
  format,
  startOfMonth,
  startOfWeek,
  WEEK_STARTS_ON,
} from "../lib/dates";

export type ViewId = "day" | "4day" | "week" | "month" | "schedule";

export const VIEWS: { id: ViewId; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "4day", label: "4 Days" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "schedule", label: "Schedule" },
];

export const DEFAULT_VIEW: ViewId = "week";

const SCHEDULE_DAYS = 28;

export interface VisibleRange {
  start: Date;
  /** Exclusive. */
  end: Date;
  days: Date[];
}

export function visibleRange(view: ViewId, anchor: Date): VisibleRange {
  let start = anchor;
  let count = 1;
  if (view === "4day") count = 4;
  if (view === "week") {
    start = startOfWeek(anchor);
    count = 7;
  }
  if (view === "month") {
    const first = startOfMonth(anchor);
    start = startOfWeek(first);
    const leadingDays = (first.getDay() - WEEK_STARTS_ON + 7) % 7;
    const daysInMonth = addDays(addMonths(first, 1), -1).getDate();
    count = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  }
  if (view === "schedule") count = SCHEDULE_DAYS;
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));
  return { start, end: addDays(start, count), days };
}

export function step(view: ViewId, anchor: Date, direction: 1 | -1): Date {
  if (view === "month") return addMonths(anchor, direction);
  const days = { day: 1, "4day": 4, week: 7, schedule: 7 }[view];
  return addDays(anchor, days * direction);
}

export function title(view: ViewId, anchor: Date, range: VisibleRange): string {
  if (view === "day") return format.fullDate(anchor);
  if (view === "month") return format.monthYear(anchor);
  const last = addDays(range.end, -1);
  if (range.start.getMonth() === last.getMonth())
    return format.monthYear(range.start);
  const sameYear = range.start.getFullYear() === last.getFullYear();
  return sameYear
    ? `${format.monthShort(range.start)} – ${format.monthShort(last)} ${last.getFullYear()}`
    : `${format.monthShort(range.start)} ${range.start.getFullYear()} – ${format.monthShort(last)} ${last.getFullYear()}`;
}
