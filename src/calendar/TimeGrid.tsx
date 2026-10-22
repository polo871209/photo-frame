import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { format, formatTimeRange, minutesIntoDay, sameDay } from "../lib/dates";
import type { RefObject } from "preact";
import { packAllDay, placeTimed, type PlacedBlock } from "./layout";
import { colorVars, type Occurrence } from "./model";

const FIRST_HOUR = 7;
const LAST_HOUR = 23;
const GRID_MARGIN_PX = 10;
const MIN_BLOCK_PX = 22;
const SHORT_BLOCK_PX = 44;
const ALL_DAY_ROWS_SHOWN = 3;

interface Props {
  days: Date[];
  occurrences: Occurrence[];
  now: Date;
  onSelect: (occurrence: Occurrence) => void;
  onOpenDay: (day: Date) => void;
}

export function TimeGrid({
  days,
  occurrences,
  now,
  onSelect,
  onOpenDay,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const hourPx = useFittedHours(scroller);
  const columns = `repeat(${days.length}, minmax(0, 1fr))`;
  const bars = packAllDay(occurrences, days[0]!, days.length);
  const allDayRows = Math.min(
    ALL_DAY_ROWS_SHOWN,
    bars.reduce((n, bar) => Math.max(n, bar.row + 1), 0),
  );
  const hiddenBars = bars.filter((bar) => bar.row >= ALL_DAY_ROWS_SHOWN).length;

  return (
    <div class={`tg${days.length === 1 ? " tg--single" : ""}`}>
      <div class="tg-head" style={`grid-template-columns:${columns}`}>
        {days.map((day) => (
          <button
            key={+day}
            class={`tg-day${sameDay(day, now) ? " is-today" : ""}`}
            onClick={() => onOpenDay(day)}
          >
            <span class="label">{format.weekdayShort(day)}</span>
            <span class="tg-date num">{day.getDate()}</span>
          </button>
        ))}
      </div>

      {allDayRows > 0 && (
        <div class="tg-allday">
          <div class="tg-gutter label">
            All day
            {hiddenBars > 0 && <b>+{hiddenBars}</b>}
          </div>
          <div
            class="tg-allday-grid"
            style={`grid-template-columns:${columns};grid-template-rows:repeat(${allDayRows}, 34px)`}
          >
            {bars
              .filter((bar) => bar.row < ALL_DAY_ROWS_SHOWN)
              .map((bar) => (
                <button
                  key={bar.occurrence.id}
                  class={`bar${bar.continuesBefore ? " bar--before" : ""}${bar.continuesAfter ? " bar--after" : ""}`}
                  style={`${colorVars(bar.occurrence.calendar.color)}grid-column:${bar.from + 1} / ${bar.to + 1};grid-row:${bar.row + 1}`}
                  onClick={() => onSelect(bar.occurrence)}
                >
                  {bar.occurrence.title}
                </button>
              ))}
          </div>
        </div>
      )}

      <div class="tg-scroll" ref={scroller}>
        <div
          class="tg-grid"
          style={`height:${24 * hourPx}px;margin:${GRID_MARGIN_PX}px 0`}
        >
          {Array.from({ length: 23 }, (_, i) => i + 1).map((hour) => (
            <div key={hour} class="tg-hour" style={`top:${hour * hourPx}px`}>
              <span>{format.hour(new Date(2000, 0, 1, hour))}</span>
            </div>
          ))}
          <div class="tg-cols" style={`grid-template-columns:${columns}`}>
            {days.map((day) => (
              <div
                key={+day}
                class={`tg-col${sameDay(day, now) ? " is-today" : ""}`}
              >
                {placeTimed(occurrences, day).map((block) => (
                  <Block
                    key={block.occurrence.id}
                    block={block}
                    now={now}
                    hourPx={hourPx}
                    onSelect={onSelect}
                  />
                ))}
                {sameDay(day, now) && (
                  <div
                    class="now-line"
                    style={`top:${(minutesIntoDay(now) / 60) * hourPx}px`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function useFittedHours(scroller: RefObject<HTMLDivElement | null>): number {
  const [hourPx, setHourPx] = useState(0);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    let current = 0;
    const fit = () => {
      const next =
        (element.clientHeight - 2 * GRID_MARGIN_PX) / (LAST_HOUR - FIRST_HOUR);
      if (next <= 0 || next === current) return;
      const shownHour = current ? element.scrollTop / current : FIRST_HOUR;
      current = next;
      setHourPx(next);
      requestAnimationFrame(() => (element.scrollTop = shownHour * next));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return hourPx;
}

function Block({
  block,
  now,
  hourPx,
  onSelect,
}: {
  block: PlacedBlock;
  now: Date;
  hourPx: number;
  onSelect: (o: Occurrence) => void;
}) {
  const { occurrence } = block;
  const top = (block.startMinute / 60) * hourPx;
  const height = Math.max(
    MIN_BLOCK_PX,
    ((block.endMinute - block.startMinute) / 60) * hourPx - 2,
  );
  const width = 100 / block.columns;
  const short = height < SHORT_BLOCK_PX;
  const state =
    occurrence.end <= now
      ? " is-past"
      : occurrence.start <= now
        ? " is-now"
        : "";
  return (
    <button
      class={`ev${short ? " is-short" : ""}${state}`}
      style={`${colorVars(occurrence.calendar.color)}top:${top}px;height:${height}px;left:calc(${block.column * width}% + 2px);width:calc(${width}% - 4px)`}
      onClick={() => onSelect(occurrence)}
    >
      <span class="ev-title">{occurrence.title}</span>
      <span class="ev-meta">
        {short
          ? format.time(occurrence.start)
          : formatTimeRange(occurrence.start, occurrence.end)}
        {!short && occurrence.location ? ` · ${occurrence.location}` : ""}
      </span>
    </button>
  );
}
