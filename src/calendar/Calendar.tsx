import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Icon } from "../icons";
import { sameDay, startOfDay } from "../lib/dates";
import { useNow } from "../lib/useNow";
import { EventSheet } from "./EventSheet";
import type { Occurrence } from "./model";
import { MonthGrid } from "./MonthGrid";
import { useCalendarPrefs, withPrefs } from "./prefs";
import { Schedule } from "./Schedule";
import { SettingsSheet } from "./SettingsSheet";
import { TimeGrid } from "./TimeGrid";
import { useEvents } from "./useEvents";
import { step, title, VIEWS, visibleRange, type ViewId } from "./views";

const IDLE_RESET_MS = 3 * 60_000;
const SWIPE_MIN_PX = 80;
const SWIPE_MAX_DRIFT_PX = 60;
const SWIPE_MAX_MS = 600;

export function Calendar() {
  const now = useNow();
  const [prefs, setPrefs] = useCalendarPrefs();
  const [view, setView] = useState<ViewId>(prefs.homeView);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<Occurrence | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const range = useMemo(() => visibleRange(view, anchor), [view, +anchor]);
  const events = useEvents(range.start, range.end);
  const occurrences = useMemo(
    () => withPrefs(events.occurrences, prefs),
    [events.occurrences, prefs],
  );

  const lastTouch = useRef(Date.now());
  const swipeStart = useRef<{ x: number; y: number; at: number } | null>(null);
  const ignoreTapsUntil = useRef(0);

  useEffect(() => {
    if (Date.now() - lastTouch.current < IDLE_RESET_MS) return;
    if (events.buildChanged) {
      location.reload();
      return;
    }
    if (
      view === prefs.homeView &&
      sameDay(anchor, now) &&
      !selected &&
      !settingsOpen
    )
      return;
    setSelected(null);
    setSettingsOpen(false);
    setView(prefs.homeView);
    setAnchor(startOfDay(now));
  }, [now]);

  const pickView = (id: ViewId) => {
    setView(id);
    setPrefs({ ...prefs, homeView: id });
  };

  const navigate = (direction: 1 | -1) =>
    setAnchor((current) => step(view, current, direction));
  const openDay = (day: Date) => {
    if (Date.now() < ignoreTapsUntil.current) return;
    setView("day");
    setAnchor(startOfDay(day));
  };
  const select = (occurrence: Occurrence) => {
    if (Date.now() < ignoreTapsUntil.current) return;
    setSelected(occurrence);
  };

  const todayShown =
    view === "month"
      ? anchor.getMonth() === now.getMonth() &&
        anchor.getFullYear() === now.getFullYear()
      : range.start <= now && now < range.end;

  return (
    <div class="cal" onPointerDown={() => (lastTouch.current = Date.now())}>
      <header class="cal-head">
        <button
          class="btn"
          disabled={todayShown}
          onClick={() => setAnchor(startOfDay(new Date()))}
        >
          Today
        </button>
        <button
          class="icon-btn"
          aria-label="Previous"
          onClick={() => navigate(-1)}
        >
          <Icon name="left" />
        </button>
        <button class="icon-btn" aria-label="Next" onClick={() => navigate(1)}>
          <Icon name="right" />
        </button>
        <h1 class="cal-title title">{title(view, anchor, range)}</h1>
        <Status
          source={events.source}
          failed={events.failed}
          error={events.error}
        />
        <div class="seg">
          {VIEWS.map(({ id, label }) => (
            <button
              key={id}
              class={id === view ? "is-on" : ""}
              onClick={() => pickView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          class="icon-btn"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Icon name="sliders" />
        </button>
      </header>

      <div
        class="cal-body"
        onPointerDown={(event) => {
          swipeStart.current = {
            x: event.clientX,
            y: event.clientY,
            at: Date.now(),
          };
        }}
        onPointerUp={(event) => {
          const start = swipeStart.current;
          swipeStart.current = null;
          if (!start) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dy) > SWIPE_MAX_DRIFT_PX)
            return;
          if (Date.now() - start.at > SWIPE_MAX_MS) return;
          ignoreTapsUntil.current = Date.now() + 400;
          navigate(dx < 0 ? 1 : -1);
        }}
      >
        {view === "month" ? (
          <MonthGrid
            month={anchor}
            days={range.days}
            occurrences={occurrences}
            now={now}
            onSelect={select}
            onOpenDay={openDay}
          />
        ) : view === "schedule" ? (
          <Schedule
            days={range.days}
            occurrences={occurrences}
            now={now}
            onSelect={select}
          />
        ) : (
          <TimeGrid
            key={`${view}:${+range.start}`}
            days={range.days}
            occurrences={occurrences}
            now={now}
            onSelect={select}
            onOpenDay={openDay}
          />
        )}
      </div>

      {selected && (
        <EventSheet occurrence={selected} onClose={() => setSelected(null)} />
      )}
      {settingsOpen && (
        <SettingsSheet
          calendars={events.calendars}
          prefs={prefs}
          onChange={setPrefs}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function Status({
  source,
  failed,
  error,
}: {
  source?: string;
  failed: string[];
  error?: string;
}) {
  if (error) return <span class="cal-status is-error">Offline · {error}</span>;
  if (failed.length)
    return (
      <span class="cal-status is-error">Not loaded: {failed.join(", ")}</span>
    );
  if (source === "sample") return <span class="cal-status">Sample events</span>;
  return null;
}
