import type { AirReading } from "../../shared/weather";
import type { Sky } from "./WeatherIcon";

/** Names a WMO weather code, as Open-Meteo documents them: https://open-meteo.com/en/docs#weather_variable_documentation */
export function describeWeather(code: number): { label: string; sky: Sky } {
  if (code === 0) return { label: "Clear", sky: "clear" };
  if (code === 1) return { label: "Mostly clear", sky: "clear" };
  if (code === 2) return { label: "Partly cloudy", sky: "partly" };
  if (code === 45 || code === 48) return { label: "Fog", sky: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", sky: "drizzle" };
  if (code === 61 || code === 63 || code === 66) {
    return { label: "Rain", sky: "rain" };
  }
  if (code === 65 || code === 67) return { label: "Heavy rain", sky: "heavy" };
  if (code === 80 || code === 81) return { label: "Showers", sky: "showers" };
  if (code === 82) return { label: "Heavy showers", sky: "heavy" };
  if (code >= 95) return { label: "Thunderstorm", sky: "storm" };
  return { label: "Cloudy", sky: "cloudy" };
}

type AirTone =
  | "good"
  | "moderate"
  | "unhealthy"
  | "very-unhealthy"
  | "hazardous";

interface AirBand {
  upTo: number;
  tone: AirTone;
  label: string;
  advice: string;
}

const HAZARDOUS: AirBand = {
  upTo: 500,
  tone: "hazardous",
  label: "Hazardous",
  advice: "Stay indoors",
};

const API_BANDS: AirBand[] = [
  { upTo: 50, tone: "good", label: "Good", advice: "Clean air" },
  {
    upTo: 100,
    tone: "moderate",
    label: "Moderate",
    advice: "Fine for most people",
  },
  {
    upTo: 200,
    tone: "unhealthy",
    label: "Unhealthy",
    advice: "Cut long outdoor activity",
  },
  {
    upTo: 300,
    tone: "very-unhealthy",
    label: "Very unhealthy",
    advice: "Stay indoors if you can",
  },
  HAZARDOUS,
];

/** The US EPA PM2.5 bands of May 2024, in µg/m³: https://www.epa.gov/system/files/documents/2024-02/pm-naaqs-air-quality-index-fact-sheet.pdf */
const PM25_BANDS: AirBand[] = [
  { upTo: 9, tone: "good", label: "Good", advice: "Clean air" },
  {
    upTo: 35.4,
    tone: "moderate",
    label: "Moderate",
    advice: "Fine for most people",
  },
  {
    upTo: 55.4,
    tone: "unhealthy",
    label: "Unhealthy for some",
    advice: "Sensitive groups stay in",
  },
  {
    upTo: 125.4,
    tone: "unhealthy",
    label: "Unhealthy",
    advice: "Cut long outdoor activity",
  },
  {
    upTo: 225.4,
    tone: "very-unhealthy",
    label: "Very unhealthy",
    advice: "Stay indoors if you can",
  },
  HAZARDOUS,
];

export function describeAir(reading: AirReading) {
  const bands = reading.scale === "api" ? API_BANDS : PM25_BANDS;
  let low = 0;
  for (const [at, band] of bands.entries()) {
    if (reading.value <= band.upTo) {
      const within = (reading.value - low) / (band.upTo - low);
      return { band, bands, fraction: (at + within) / bands.length };
    }
    low = band.upTo;
  }
  return { band: HAZARDOUS, bands, fraction: 1 };
}
