import { useEffect, useState } from "preact/hooks";
import type { AirPlace, AirReading, Forecast } from "../../shared/weather";
import { Icon } from "../icons";
import { format, parseLocalDate, sameDay, startOfDay } from "../lib/dates";
import { isIdle } from "../lib/idle";
import { useNow } from "../lib/useNow";
import {
  describeApi,
  describePm25,
  describeWeather,
  type AirLevel,
} from "./labels";
import { useWeather } from "./useWeather";

const SLOT_HOURS = [6, 9, 12, 15, 18, 21];
const HOUR_MS = 3600e3;

type Day = Forecast["days"][number] & { start: Date };

export function Weather() {
  const { data, error } = useWeather();
  const now = useNow();
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      if (isIdle()) setPicked(null);
    }, 10_000);
    return () => clearInterval(timer);
  }, []);

  const status = error && <span class="wx-status">Offline · {error}</span>;
  if (!data) return <div class="wx">{status}</div>;
  const { forecast } = data;
  const today = startOfDay(now);
  const days: Day[] = (forecast?.days ?? [])
    .map((day) => ({ ...day, start: parseLocalDate(day.date) }))
    .filter(({ start }) => start >= today);
  const day = days.find(({ date }) => date === picked) ?? days[0];
  const isToday = !!day && sameDay(day.start, today);

  return (
    <div class="wx">
      <header class="wx-head">
        <h1 class="title">{data.place}</h1>
        <span class="label">{format.fullDate(day?.start ?? now)}</span>
      </header>
      <div class="wx-top">
        {forecast && day ? (
          <Summary day={day} current={isToday ? forecast.current : undefined} />
        ) : (
          <p class="wx-none">No forecast</p>
        )}
        <Air places={data.air} />
      </div>
      {forecast && day && (
        <Slots hours={forecast.hours} day={day.start} now={now} />
      )}
      <nav class="wx-days">
        {days.map((entry) => (
          <button
            key={entry.date}
            class={`wx-day${entry === day ? " is-on" : ""}`}
            aria-pressed={entry === day}
            onClick={() => setPicked(entry.date)}
          >
            <span class="label">
              {sameDay(entry.start, today)
                ? "Today"
                : format.weekdayShort(entry.start)}
            </span>
            <Icon name={describeWeather(entry.code, true).icon} size={40} />
            <span class="wx-day-temps">
              <span class="num wx-max">{degrees(entry.maxC)}</span>
              <span class="num wx-min">{degrees(entry.minC)}</span>
            </span>
          </button>
        ))}
      </nav>
      {status}
    </div>
  );
}

function Summary({
  day,
  current,
}: {
  day: Day;
  current: Forecast["current"] | undefined;
}) {
  const condition = current
    ? describeWeather(current.code, current.isDay)
    : describeWeather(day.code, true);
  return (
    <section class="wx-now">
      <Icon name={condition.icon} size={132} />
      <span class="num wx-temp">{degrees(current?.tempC ?? day.maxC)}</span>
      <div>
        <p class="title wx-cond">{condition.label}</p>
        <p class="wx-sub">
          High {degrees(day.maxC)} · Low {degrees(day.minC)}
        </p>
        {day.rainChance !== null && (
          <p class="wx-sub">
            <Icon name="umbrella" size={22} />
            Rain {day.rainChance}%
          </p>
        )}
      </div>
    </section>
  );
}

function Air({ places }: { places: AirPlace[] }) {
  const [main, ...nearby] = places;
  const reading = main?.reading;
  if (!main || !reading) {
    return (
      <section class="wx-air">
        <span class="label">Air quality{main && ` · ${main.place}`}</span>
        <p class="wx-none">No reading</p>
        <NearbyAir places={nearby} />
      </section>
    );
  }
  const level = describeReading(reading);
  return (
    <section class="wx-air" data-tone={level.tone}>
      <span class="label">
        {scaleName(reading)} · {main.place}
      </span>
      <div class="wx-air-main">
        <span class="num wx-air-value">{Math.round(reading.value)}</span>
        <div>
          <p class="title wx-air-level">{level.label}</p>
          <p class="wx-air-advice">{level.advice}</p>
        </div>
      </div>
      <NearbyAir places={nearby} />
      <span class="label">
        {main.source} · {format.time(new Date(reading.at))}
      </span>
    </section>
  );
}

function NearbyAir({ places }: { places: AirPlace[] }) {
  return (
    <ul class="wx-air-nearby">
      {places.map(({ place, source, reading }) => (
        <li key={place}>
          <span class="wx-air-place">{place}</span>
          <span class="label">
            {reading ? scaleName(reading) : "No reading"} · {source}
          </span>
          {reading && (
            <span class="num">{Math.round(reading.value)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function describeReading(reading: AirReading): AirLevel {
  return reading.scale === "api"
    ? describeApi(reading.value)
    : describePm25(reading.value);
}

function scaleName(reading: AirReading) {
  return reading.scale === "api" ? (
    "Air pollutant index"
  ) : (
    <>
      PM2.5 <span class="wx-unit">µg/m³</span>
    </>
  );
}

function Slots({
  hours,
  day,
  now,
}: {
  hours: Forecast["hours"];
  day: Date;
  now: Date;
}) {
  const slots = hours
    .map((hour) => ({ ...hour, start: new Date(hour.at) }))
    .filter(
      ({ start }) =>
        sameDay(start, day) && SLOT_HOURS.includes(start.getHours()),
    );
  return (
    <ol class="wx-slots">
      {slots.map((slot) => (
        <li
          key={slot.at}
          class={+slot.start + HOUR_MS <= +now ? "is-past" : undefined}
        >
          <span class="label">{format.hour(slot.start)}</span>
          <Icon name={describeWeather(slot.code, slot.isDay).icon} size={36} />
          <span class="num wx-slot-temp">{degrees(slot.tempC)}</span>
          {slot.rainChance !== null && (
            <span class="wx-rain">
              <Icon name="umbrella" size={16} />
              {slot.rainChance}%
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function degrees(celsius: number): string {
  return `${Math.round(celsius)}°`;
}
