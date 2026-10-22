import { addDays, DAY_MS, startOfDay } from "../lib/dates";
import type { Occurrence } from "./model";

export interface PlacedBlock {
  occurrence: Occurrence;
  startMinute: number;
  endMinute: number;
  column: number;
  columns: number;
}

export function placeTimed(
  occurrences: Occurrence[],
  day: Date,
): PlacedBlock[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const segments = occurrences
    .filter((o) => !spansDays(o) && o.start < dayEnd && o.end > dayStart)
    .map((occurrence) => ({
      occurrence,
      startMinute: minutesFrom(
        dayStart,
        occurrence.start < dayStart ? dayStart : occurrence.start,
      ),
      endMinute: minutesFrom(
        dayStart,
        occurrence.end > dayEnd ? dayEnd : occurrence.end,
      ),
    }))
    .sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);

  const placed: PlacedBlock[] = [];
  let cluster: PlacedBlock[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -1;
  const closeCluster = () => {
    for (const block of cluster) block.columns = columnEnds.length;
    placed.push(...cluster);
    cluster = [];
    columnEnds = [];
  };

  for (const segment of segments) {
    if (segment.startMinute >= clusterEnd) closeCluster();
    let column = columnEnds.findIndex((end) => end <= segment.startMinute);
    if (column < 0) column = columnEnds.push(0) - 1;
    columnEnds[column] = Math.max(segment.endMinute, segment.startMinute + 15);
    clusterEnd = Math.max(clusterEnd, columnEnds[column] ?? 0);
    cluster.push({ ...segment, column, columns: 1 });
  }
  closeCluster();
  return placed;
}

export interface AllDayBar {
  occurrence: Occurrence;
  from: number;
  to: number;
  row: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export function packAllDay(
  occurrences: Occurrence[],
  rangeStart: Date,
  dayCount: number,
): AllDayBar[] {
  const rowEnds: number[] = [];
  const bars: AllDayBar[] = [];
  for (const occurrence of occurrences.filter(spansDays)) {
    const first = dayIndex(rangeStart, occurrence.start);
    const endDay = startOfDay(occurrence.end);
    const last =
      dayIndex(rangeStart, endDay) + (+endDay === +occurrence.end ? 0 : 1);
    const from = Math.max(0, first);
    const to = Math.min(dayCount, last);
    if (to <= from) continue;
    let row = rowEnds.findIndex((end) => end <= from);
    if (row < 0) row = rowEnds.push(0) - 1;
    rowEnds[row] = to;
    bars.push({
      occurrence,
      from,
      to,
      row,
      continuesBefore: first < 0,
      continuesAfter: last > dayCount,
    });
  }
  return bars;
}

export function spansDays(occurrence: Occurrence): boolean {
  return occurrence.allDay || +occurrence.end - +occurrence.start >= DAY_MS;
}

function dayIndex(rangeStart: Date, date: Date): number {
  return Math.round((+startOfDay(date) - +rangeStart) / DAY_MS);
}

function minutesFrom(dayStart: Date, date: Date): number {
  return (+date - +dayStart) / 60_000;
}
