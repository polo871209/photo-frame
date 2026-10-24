import { format, formatTimeRange, sameDay } from "../lib/dates";
import { spansDays } from "./layout";
import { colorVars, onDay, type Occurrence } from "./model";

interface Props {
  days: Date[];
  occurrences: Occurrence[];
  now: Date;
  onSelect: (occurrence: Occurrence) => void;
}

export function Schedule({ days, occurrences, now, onSelect }: Props) {
  const groups = days
    .map((day) => ({ day, items: onDay(occurrences, day) }))
    .filter((group) => group.items.length > 0);

  if (!groups.length) {
    return <div class="empty title">Nothing planned in the next four weeks.</div>;
  }

  return (
    <div class="sch">
      {groups.map(({ day, items }) => (
        <section key={+day} class={`sch-day${sameDay(day, now) ? " is-today" : ""}`}>
          <div class="sch-date">
            <span class="num">{day.getDate()}</span>
            <span class="label">
              {format.weekdayShort(day)} · {format.monthShort(day)}
            </span>
          </div>
          <div class="sch-list">
            {items.map((occurrence) => (
              <button
                key={occurrence.id}
                class={`sch-ev${occurrence.end <= now ? " is-past" : ""}`}
                style={colorVars(occurrence.calendar.color)}
                onClick={() => onSelect(occurrence)}
              >
                <i />
                <span class="sch-time">
                  {spansDays(occurrence) ? "All day" : formatTimeRange(occurrence.start, occurrence.end)}
                </span>
                <span class="sch-title">{occurrence.title}</span>
                {occurrence.location && <span class="sch-loc">{occurrence.location}</span>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
