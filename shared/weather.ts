/** The body of `GET /api/weather`. */
export interface WeatherReport {
  place: string;
  /** `null` when Open-Meteo failed. */
  forecast: Forecast | null;
  /** Always the same places in the same order. The first is where the frame stands. */
  air: AirPlace[];
}

export interface Forecast {
  current: { tempC: number; code: number; isDay: boolean };
  /** Every hour from midnight today for 7 days. `at` is an ISO instant. `code` is a WMO weather code. */
  hours: {
    at: string;
    tempC: number;
    code: number;
    isDay: boolean;
    rainChance: number | null;
  }[];
  /** Today and the next 6 days. `date` is `YYYY-MM-DD` in the place's time zone. */
  days: {
    date: string;
    code: number;
    minC: number;
    maxC: number;
    rainChance: number | null;
  }[];
}

export interface AirPlace {
  place: string;
  /** Who measured `reading`, for example "DOE Cheras" when the nearest station is outside `place`. */
  source: string;
  /** `null` when the source failed or had no fresh reading. */
  reading: AirReading | null;
}

export interface AirReading {
  /** `api` is Malaysia's Air Pollutant Index from a DOE station. `pm25` is PM2.5 in µg/m³ from AirGradient sensors. */
  scale: "api" | "pm25";
  value: number;
  /** When it was measured, as an ISO instant. */
  at: string;
}
