import type { CalendarInfo } from "../../shared/events";
import { Icon } from "../icons";
import { colorVars } from "./model";
import {
  WHITE_TEXT_COLORS,
  setColor,
  toggleHidden,
  type CalendarPrefs,
} from "./prefs";

export function SettingsSheet({
  calendars,
  prefs,
  onChange,
  onClose,
}: {
  calendars: CalendarInfo[];
  prefs: CalendarPrefs;
  onChange: (prefs: CalendarPrefs) => void;
  onClose: () => void;
}) {
  return (
    <div class="sheet-layer" onClick={onClose}>
      <div class="sheet" onClick={(event) => event.stopPropagation()}>
        <div class="sheet-head">
          <h2 class="title">Calendars</h2>
          <button class="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={28} />
          </button>
        </div>
        <div class="sheet-body">
          {calendars.length === 0 && (
            <p class="set-empty">No calendars loaded yet.</p>
          )}
          {calendars.map((calendar) => {
            const shown = !prefs.hidden.includes(calendar.name);
            const color = prefs.colors[calendar.name] ?? calendar.color;
            const swatches = [
              calendar.color,
              ...WHITE_TEXT_COLORS.filter(
                (swatch) =>
                  swatch.toUpperCase() !== calendar.color.toUpperCase(),
              ),
            ];
            return (
              <div
                key={calendar.id}
                class={`set-cal${shown ? "" : " is-hidden"}`}
                style={colorVars(color)}
              >
                <button
                  class="set-toggle"
                  aria-pressed={shown}
                  onClick={() => onChange(toggleHidden(prefs, calendar.name))}
                >
                  <i class="set-dot" />
                  <span class="set-name">{calendar.name}</span>
                  <span class={`switch${shown ? " is-on" : ""}`} />
                </button>
                <div class="set-swatches">
                  {swatches.map((swatch) => (
                    <button
                      key={swatch}
                      class={`swatch${swatch === color ? " is-on" : ""}`}
                      style={colorVars(swatch)}
                      aria-label={`${calendar.name} color ${swatch}`}
                      onClick={() =>
                        onChange(
                          setColor(
                            prefs,
                            calendar.name,
                            swatch === calendar.color ? undefined : swatch,
                          ),
                        )
                      }
                    >
                      <i />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
