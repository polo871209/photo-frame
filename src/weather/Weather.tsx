import { useEffect, useState } from "preact/hooks";
import type { AirPlace, AirReading, Forecast } from "../../shared/weather";
import { format, parseLocalDate, sameDay, startOfDay } from "../lib/dates";
import { isIdle } from "../lib/idle";
import { useNow } from "../lib/useNow";
import { describeAir, describeWeather } from "./labels";
import { useWeather } from "./useWeather";
import { RainDrop, WeatherIcon } from "./WeatherIcon";

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
            <WeatherIcon sky={describeWeather(entry.code).sky} isDay size={56} />
            <span class="wx-day-temps">
              <span class="num wx-max">{degrees(entry.maxC)}</span>
              <span class="num wx-min">{degrees(entry.minC)}</span>
            </span>
            <Rain chance={entry.rainChance} />
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
  const condition = describeWeather(current?.code ?? day.code);
  return (
    <section class="wx-now">
      <WeatherIcon
        sky={condition.sky}
        isDay={current?.isDay ?? true}
        size={168}
      />
      <span class="num wx-temp">{degrees(current?.tempC ?? day.maxC)}</span>
      <div>
        <p class="title wx-cond">{condition.label}</p>
        <p class="wx-sub">
          High {degrees(day.maxC)} · Low {degrees(day.minC)}
        </p>
        <Rain chance={day.rainChance} />
      </div>
    </section>
  );
}

function Air({ places }: { places: AirPlace[] }) {
  const [main, ...nearby] = places;
  const reading = main?.reading;
  const air = reading && describeAir(reading);
  return (
    <section class="wx-air">
      <span class="label">
        {reading ? scaleName(reading) : "Air quality"}
        {main && ` · ${main.place}`}
      </span>
      {air ? (
        <>
          <div class="wx-air-main">
            <span class="num wx-air-value">{Math.round(reading.value)}</span>
            <div>
              <p class="title wx-air-level">{air.band.label}</p>
              <p class="wx-air-advice">{air.band.advice}</p>
            </div>
          </div>
          <div class="wx-scale">
            {air.bands.map(({ upTo, tone }) => (
              <span key={upTo} data-tone={tone} />
            ))}
            <i style={{ left: `${air.fraction * 100}%` }} />
          </div>
        </>
      ) : (
        <p class="wx-none">No reading</p>
      )}
      <ul class="wx-air-nearby">
        {nearby.map(({ place, source, reading }) => (
          <li key={place}>
            <span class="wx-air-place">{place}</span>
            <span class="label">
              {reading ? scaleName(reading) : "No reading"} · {source}
            </span>
            {reading && (
              <>
                <span class="wx-dot" data-tone={describeAir(reading).band.tone} />
                <span class="num">{Math.round(reading.value)}</span>
              </>
            )}
          </li>
        ))}
      </ul>
      {reading && (
        <span class="label">
          {main.source} · {format.time(new Date(reading.at))}
        </span>
      )}
    </section>
  );
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
          <WeatherIcon
            sky={describeWeather(slot.code).sky}
            isDay={slot.isDay}
            size={56}
          />
          <span class="num wx-slot-temp">{degrees(slot.tempC)}</span>
          <Rain chance={slot.rainChance} />
        </li>
      ))}
    </ol>
  );
}

function Rain({ chance }: { chance: number | null }) {
  if (chance === null) return null;
  return (
    <span class="wx-rain">
      <RainDrop size={18} />
      {chance}%
    </span>
  );
}

function degrees(celsius: number): string {
  return `${Math.round(celsius)}°`;
}
