import { Icon } from "../icons";
import { addDays, format, formatTimeRange, sameDay } from "../lib/dates";
import { colorVars, type Occurrence } from "./model";

export function EventSheet({
  occurrence,
  onClose,
}: {
  occurrence: Occurrence;
  onClose: () => void;
}) {
  return (
    <div class="sheet-layer" onClick={onClose}>
      <div
        class="sheet"
        style={colorVars(occurrence.calendar.color)}
        onClick={(event) => event.stopPropagation()}
      >
        <div class="sheet-band">
          <span class="label label--on">{occurrence.calendar.name}</span>
          <h2 class="serif">{occurrence.title}</h2>
          <div class="sheet-when">{when(occurrence)}</div>
          <button class="sheet-x" onClick={onClose} aria-label="Close">
            <Icon name="close" size={28} />
          </button>
        </div>
        {(occurrence.location || occurrence.description) && (
          <div class="sheet-body">
            {occurrence.location && (
              <div class="sheet-row">
                <Icon name="pin" size={26} />
                <span>{occurrence.location}</span>
              </div>
            )}
            {occurrence.description && (
              <div class="sheet-row sheet-notes">
                <Icon name="notes" size={26} />
                <p>{occurrence.description}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function when(occurrence: Occurrence): string {
  const { start, end } = occurrence;
  if (occurrence.allDay) {
    const last = addDays(end, -1);
    return sameDay(start, last)
      ? `${format.fullDate(start)} · All day`
      : `${format.fullDate(start)} – ${format.fullDate(last)}`;
  }
  if (sameDay(start, end)) {
    return `${format.fullDate(start)} · ${formatTimeRange(start, end)}`;
  }
  return `${format.fullDate(start)} ${format.time(start)} – ${format.fullDate(end)} ${format.time(end)}`;
}
