import { format, sameDay } from "../lib/dates";
import { spansDays } from "./layout";
import { colorVars, onDay, type Occurrence } from "./model";

const ITEMS_PER_CELL = 3;

interface Props {
  month: Date;
  days: Date[];
  occurrences: Occurrence[];
  now: Date;
  onSelect: (occurrence: Occurrence) => void;
  onOpenDay: (day: Date) => void;
}

export function MonthGrid({ month, days, occurrences, now, onSelect, onOpenDay }: Props) {
  return (
    <div class="mo">
      <div class="mo-dow">
        {days.slice(0, 7).map((day) => (
          <span key={+day} class="label">
            {format.weekdayShort(day)}
          </span>
        ))}
      </div>
      <div class="mo-grid" style={`grid-template-rows:repeat(${days.length / 7}, minmax(0, 1fr))`}>
        {days.map((day) => {
          const items = onDay(occurrences, day);
          const hidden = items.length - ITEMS_PER_CELL;
          const outside = day.getMonth() !== month.getMonth();
          return (
            <div
              key={+day}
              class={`mo-cell${outside ? " is-out" : ""}${sameDay(day, now) ? " is-today" : ""}`}
              onClick={() => onOpenDay(day)}
            >
              <span class="mo-date num">{day.getDate()}</span>
              {items.slice(0, ITEMS_PER_CELL).map((occurrence) => (
                <button
                  key={occurrence.id}
                  class={spansDays(occurrence) ? "mo-bar" : "mo-ev"}
                  style={colorVars(occurrence.calendar.color)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(occurrence);
                  }}
                >
                  {!spansDays(occurrence) && <span class="mo-time">{format.time(occurrence.start)}</span>}
                  <span class="mo-title">{occurrence.title}</span>
                </button>
              ))}
              {hidden > 0 && <span class="mo-more">+{hidden} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
