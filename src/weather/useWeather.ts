import { useEffect, useState } from "preact/hooks";
import type { WeatherReport } from "../../shared/weather";

const POLL_MS = 10 * 60_000;

export interface WeatherState {
  data?: WeatherReport;
  error?: string;
}

/** Polls `/api/weather`. If a source fails, it keeps that source's last answer. */
export function useWeather(): WeatherState {
  const [state, setState] = useState<WeatherState>({});

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/weather", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: WeatherReport = await response.json();
        setState(({ data: previous }) => ({
          data: {
            ...data,
            forecast: data.forecast ?? previous?.forecast ?? null,
            air: data.air.map(
              (entry) =>
                (!entry.reading &&
                  previous?.air.find(({ place }) => place === entry.place)) ||
                entry,
            ),
          },
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          error: (error as Error).message,
        }));
      }
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return state;
}
