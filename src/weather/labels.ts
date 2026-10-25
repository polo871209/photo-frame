import type { IconName } from "../icons";

/** Names a WMO weather code, as Open-Meteo documents them: https://open-meteo.com/en/docs#weather_variable_documentation */
export function describeWeather(
  code: number,
  isDay: boolean,
): { label: string; icon: IconName } {
  if (code === 0) return { label: "Clear", icon: isDay ? "sun" : "moon" };
  if (code === 1)
    return { label: "Mostly clear", icon: isDay ? "sun" : "moon" };
  if (code === 2) {
    return { label: "Partly cloudy", icon: isDay ? "cloudSun" : "cloudMoon" };
  }
  if (code === 45 || code === 48) return { label: "Fog", icon: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "drizzle" };
  if (code === 61 || code === 63 || code === 66) {
    return { label: "Rain", icon: "rain" };
  }
  if (code === 65 || code === 67) return { label: "Heavy rain", icon: "rain" };
  if (code === 80 || code === 81) return { label: "Showers", icon: "rain" };
  if (code === 82) return { label: "Heavy showers", icon: "rain" };
  if (code >= 95) return { label: "Thunderstorm", icon: "storm" };
  if (code >= 71 && code <= 86) return { label: "Snow", icon: "cloud" };
  return { label: "Cloudy", icon: "cloud" };
}

export type AirTone =
  | "good"
  | "moderate"
  | "unhealthy"
  | "very-unhealthy"
  | "hazardous";

export interface AirLevel {
  tone: AirTone;
  label: string;
  advice: string;
}

/** The DOE bands of Malaysia's Air Pollutant Index, with the DOE's advice in short. */
export function describeApi(api: number): AirLevel {
  if (api <= 50) return { tone: "good", label: "Good", advice: "Clean air" };
  if (api <= 100) {
    return { tone: "moderate", label: "Moderate", advice: "Fine for most people" };
  }
  if (api <= 200) {
    return { tone: "unhealthy", label: "Unhealthy", advice: "Cut long outdoor activity" };
  }
  if (api <= 300) {
    return { tone: "very-unhealthy", label: "Very unhealthy", advice: "Stay indoors if you can" };
  }
  return { tone: "hazardous", label: "Hazardous", advice: "Stay indoors" };
}

/** The US EPA PM2.5 bands of May 2024, in µg/m³: https://www.epa.gov/system/files/documents/2024-02/pm-naaqs-air-quality-index-fact-sheet.pdf */
export function describePm25(pm25: number): AirLevel {
  if (pm25 <= 9) return { tone: "good", label: "Good", advice: "Clean air" };
  if (pm25 <= 35.4) {
    return { tone: "moderate", label: "Moderate", advice: "Fine for most people" };
  }
  if (pm25 <= 55.4) {
    return { tone: "unhealthy", label: "Unhealthy for some", advice: "Sensitive groups stay in" };
  }
  if (pm25 <= 125.4) {
    return { tone: "unhealthy", label: "Unhealthy", advice: "Cut long outdoor activity" };
  }
  if (pm25 <= 225.4) {
    return { tone: "very-unhealthy", label: "Very unhealthy", advice: "Stay indoors if you can" };
  }
  return { tone: "hazardous", label: "Hazardous", advice: "Stay indoors" };
}
