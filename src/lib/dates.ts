export const WEEK_STARTS_ON = 1;
export const DAY_MS = 864e5;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() - WEEK_STARTS_ON + 7) % 7));
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Parses `YYYY-MM-DD` as local midnight, so all-day events stay on their calendar date. */
export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function minutesIntoDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatter(options: Intl.DateTimeFormatOptions) {
  const format = new Intl.DateTimeFormat(undefined, options);
  return (date: Date) => format.format(date);
}

export const format = {
  time: formatter({ hour: "numeric", minute: "2-digit" }),
  hour: formatter({ hour: "numeric" }),
  weekdayShort: formatter({ weekday: "short" }),
  weekdayLong: formatter({ weekday: "long" }),
  monthLong: formatter({ month: "long" }),
  monthShort: formatter({ month: "short" }),
  monthYear: formatter({ month: "long", year: "numeric" }),
  fullDate: formatter({
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }),
};

export function formatTimeRange(start: Date, end: Date): string {
  return `${format.time(start)} – ${format.time(end)}`;
}
