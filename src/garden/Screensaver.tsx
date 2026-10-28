import { useMemo } from "preact/hooks";
import { colorVars, type Occurrence } from "../calendar/model";
import { useCalendarPrefs, withPrefs } from "../calendar/prefs";
import { useEvents } from "../calendar/useEvents";
import { addDays, clockParts, format, sameDay, startOfDay } from "../lib/dates";
import { useNow } from "../lib/useNow";
import { describeWeather } from "../weather/labels";
import { useWeather } from "../weather/useWeather";
import { WeatherIcon } from "../weather/WeatherIcon";
import { Garden } from "./Garden";

const LOOKAHEAD_DAYS = 2;

export function Screensaver({ onClose }: { onClose: () => void }) {
  const now = useNow();
  const { time, period } = clockParts(now);
  const current = useWeather().data?.forecast?.current;

  return (
    <div class="garden-saver" onClick={onClose}>
      <Garden interactive={false} />
      <div class="saver-clock">
        <div class="saver-time">
          <span class="num">{time}</span>
          {period && <span class="label">{period}</span>}
        </div>
        <span class="label">{format.fullDate(now)}</span>
      </div>
      <div class="saver-side">
        {current && (
          <div class="saver-weather">
            <WeatherIcon
              sky={describeWeather(current.code).sky}
              isDay={current.isDay}
              size={56}
            />
            <span class="num">{Math.round(current.tempC)}°</span>
          </div>
        )}
        <NextEvent now={now} />
      </div>
    </div>
  );
}

function NextEvent({ now }: { now: Date }) {
  const today = +startOfDay(now);
  const { start, end } = useMemo(
    () => ({
      start: new Date(today),
      end: addDays(new Date(today), LOOKAHEAD_DAYS),
    }),
    [today],
  );
  const { occurrences } = useEvents(start, end);
  const [prefs] = useCalendarPrefs();
  const next = withPrefs(occurrences, prefs).find(
    (occurrence) => !occurrence.allDay && occurrence.end > now,
  );
  if (!next) return null;
  return (
    <div class="saver-event" style={colorVars(next.calendar.color)}>
      <span class="label">{when(next, now)}</span>
      <span class="saver-event-title">{next.title}</span>
    </div>
  );
}

function when(occurrence: Occurrence, now: Date): string {
  if (occurrence.start <= now)
    return `Now · until ${format.time(occurrence.end)}`;
  const time = format.time(occurrence.start);
  return sameDay(occurrence.start, now)
    ? `Next · ${time}`
    : `Next · ${format.weekdayShort(occurrence.start)} ${time}`;
}
