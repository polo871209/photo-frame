import { useEffect, useState } from "preact/hooks";
import type { CalendarInfo, EventsResponse } from "../../shared/events";
import { toOccurrences, type Occurrence } from "./model";

export interface EventsState {
  occurrences: Occurrence[];
  calendars: CalendarInfo[];
  source?: EventsResponse["source"];
  failed: string[];
  error?: string;
}

export function useEvents(start: Date, end: Date): EventsState {
  const [state, setState] = useState<EventsState>({
    occurrences: [],
    calendars: [],
    failed: [],
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
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<EventsResponse>;
      })
      .then((body) =>
        setState({
          occurrences: toOccurrences(body, start, end),
          calendars: body.calendars,
          source: body.source,
          failed: body.failed,
        }),
      )
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({ ...previous, error: error.message }));
      });
    return () => controller.abort();
  }, [+start, +end, refresh]);

  return state;
}
