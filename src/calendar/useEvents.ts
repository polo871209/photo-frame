import { useEffect, useState } from "preact/hooks";
import { BUILD_HEADER, BUILD_ID } from "../../shared/build";
import type { CalendarInfo, EventsResponse } from "../../shared/events";
import { toOccurrences, type Occurrence } from "./model";

export interface EventsState {
  occurrences: Occurrence[];
  calendars: CalendarInfo[];
  source?: EventsResponse["source"];
  failed: string[];
  error?: string;
  buildChanged: boolean;
}

export function useEvents(start: Date, end: Date): EventsState {
  const [state, setState] = useState<EventsState>({
    occurrences: [],
    calendars: [],
    failed: [],
    buildChanged: false,
  });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setRefresh((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      from: start.toISOString(),
      to: end.toISOString(),
    });
    fetch(`/api/events?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body: EventsResponse = await response.json();
        setState({
          occurrences: toOccurrences(body, start, end),
          calendars: body.calendars,
          source: body.source,
          failed: body.failed,
          buildChanged: response.headers.get(BUILD_HEADER) !== BUILD_ID,
        });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({ ...previous, error: error.message }));
      });
    return () => controller.abort();
  }, [+start, +end, refresh]);

  return state;
}
