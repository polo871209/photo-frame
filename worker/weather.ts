import type {
  AirPlace,
  AirReading,
  Forecast,
  WeatherReport,
} from "../shared/weather";

const FORECAST_PLACE = {
  name: "Petaling Jaya",
  latitude: 3.11806,
  longitude: 101.62083,
};
type AirSite = { place: string; source: string } & (
  | { doeStation: string }
  | { airGradientLocations: number[] }
);
const AIR_SITES: AirSite[] = [
  { place: "SS2", source: "DOE Petaling Jaya", doeStation: "CA19B" },
  {
    place: "TTDI",
    source: "AirGradient",
    airGradientLocations: [86311, 211198],
  },
  { place: "Bangsar", source: "DOE Cheras", doeStation: "CA16W" },
];

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
const APIMS =
  "https://eqms.doe.gov.my/api3/publicmapproxy/PUBLIC_DISPLAY/CAQM_MCAQM_Current_Reading/MapServer/0/query";
const AIRGRADIENT = "https://api.airgradient.com/public/api/v1/world/locations";
const FORECAST_DAYS = 7;
const CACHE_S = 600;
const SENSOR_STALE_MS = 2 * 3600e3;
// APIMS stores Malaysian wall time as if it were UTC, and Malaysia keeps UTC+8 all year.
const APIMS_OFFSET_MS = 8 * 3600e3;

interface OpenMeteoResponse {
  utc_offset_seconds: number;
  current: Record<"temperature_2m" | "weather_code" | "is_day", number>;
  hourly: { time: string[] } & Record<
    "temperature_2m" | "weather_code" | "is_day" | "precipitation_probability",
    (number | null)[]
  >;
  daily: { time: string[] } & Record<
    | "weather_code"
    | "temperature_2m_min"
    | "temperature_2m_max"
    | "precipitation_probability_max",
    (number | null)[]
  >;
}

interface ApimsResponse {
  features?: {
    attributes: {
      STATION_ID: string;
      DATETIME: number | null;
      API: number | null;
    };
  }[];
  error?: { message: string };
}

interface AirGradientMeasures {
  offline: boolean;
  pm02: number | null;
  timestamp: string;
}

export async function weatherReport(): Promise<WeatherReport> {
  const doe = orNull("APIMS", () =>
    apims(AIR_SITES.flatMap((site) => ("doeStation" in site ? [site.doeStation] : []))),
  );
  const [forecast, air] = await Promise.all([
    orNull("Open-Meteo", openMeteo),
    Promise.all(
      AIR_SITES.map(
        async (site): Promise<AirPlace> => ({
          place: site.place,
          source: site.source,
          reading:
            "doeStation" in site
              ? ((await doe)?.get(site.doeStation) ?? null)
              : await orNull(`AirGradient ${site.place}`, () =>
                  airGradient(site.airGradientLocations),
                ),
        }),
      ),
    ),
  ]);
  return { place: FORECAST_PLACE.name, forecast, air };
}

async function orNull<T>(
  source: string,
  load: () => Promise<T>,
): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    console.error(`${source} failed:`, error);
    return null;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cf: { cacheTtl: CACHE_S, cacheEverything: true },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function openMeteo(): Promise<Forecast> {
  const query = new URLSearchParams({
    latitude: String(FORECAST_PLACE.latitude),
    longitude: String(FORECAST_PLACE.longitude),
    timezone: "auto",
    current: "temperature_2m,weather_code,is_day",
    hourly: "temperature_2m,weather_code,is_day,precipitation_probability",
    daily:
      "weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max",
    forecast_days: String(FORECAST_DAYS),
  });
  const { utc_offset_seconds, current, hourly, daily } =
    await getJson<OpenMeteoResponse>(`${OPEN_METEO}?${query}`);
  const instant = (local: string) =>
    new Date(Date.parse(`${local}Z`) - utc_offset_seconds * 1000).toISOString();

  return {
    current: {
      tempC: current.temperature_2m,
      code: current.weather_code,
      isDay: current.is_day === 1,
    },
    hours: hourly.time.map((time, i) => ({
      at: instant(time),
      tempC: required(hourly.temperature_2m[i]),
      code: required(hourly.weather_code[i]),
      isDay: hourly.is_day[i] === 1,
      rainChance: hourly.precipitation_probability[i] ?? null,
    })),
    days: daily.time.map((date, i) => ({
      date,
      code: required(daily.weather_code[i]),
      minC: required(daily.temperature_2m_min[i]),
      maxC: required(daily.temperature_2m_max[i]),
      rainChance: daily.precipitation_probability_max[i] ?? null,
    })),
  };
}

function required(value: number | null | undefined): number {
  if (typeof value !== "number") throw new Error("forecast has a gap");
  return value;
}

async function apims(stations: string[]): Promise<Map<string, AirReading>> {
  const query = new URLSearchParams({
    where: `STATION_ID IN (${stations.map((id) => `'${id}'`).join(",")})`,
    outFields: "STATION_ID,DATETIME,API",
    f: "json",
  });
  const { features, error } = await getJson<ApimsResponse>(`${APIMS}?${query}`);
  if (!features) throw new Error(error?.message ?? "no features");
  const readings = new Map<string, AirReading>();
  for (const { attributes: station } of features) {
    if (
      typeof station.API !== "number" ||
      station.API < 0 ||
      typeof station.DATETIME !== "number"
    ) {
      continue;
    }
    readings.set(station.STATION_ID, {
      scale: "api",
      value: Math.round(station.API),
      at: new Date(station.DATETIME - APIMS_OFFSET_MS).toISOString(),
    });
  }
  return readings;
}

async function airGradient(locations: number[]): Promise<AirReading> {
  const sensors = await Promise.all(
    locations.map((id) =>
      orNull(`AirGradient ${id}`, () =>
        getJson<AirGradientMeasures>(`${AIRGRADIENT}/${id}/measures/current`),
      ),
    ),
  );
  const fresh = sensors.flatMap((sensor) =>
    sensor &&
    !sensor.offline &&
    typeof sensor.pm02 === "number" &&
    Date.now() - Date.parse(sensor.timestamp) < SENSOR_STALE_MS
      ? [{ pm25: sensor.pm02, at: Date.parse(sensor.timestamp) }]
      : [],
  );
  if (!fresh.length) throw new Error("no sensor has a fresh reading");
  const mean =
    fresh.reduce((sum, sensor) => sum + sensor.pm25, 0) / fresh.length;
  return {
    scale: "pm25",
    value: Math.round(mean * 10) / 10,
    at: new Date(Math.max(...fresh.map((sensor) => sensor.at))).toISOString(),
  };
}
