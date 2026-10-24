import { useEffect, useState } from "preact/hooks";
import type { ScreenId } from "../shared/control";
import { Calendar } from "./calendar/Calendar";
import { useFrameControl } from "./control/useFrameControl";
import { Icon, type IconName } from "./icons";
import { clockParts } from "./lib/dates";
import { isIdle } from "./lib/idle";
import { prefetchThenReload } from "./lib/reload";
import { useNow } from "./lib/useNow";
import { NowPlaying } from "./music/NowPlaying";

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 800;
const SCREEN_KEY = "frame.screen";

const SCREENS = [
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "music", label: "Music", icon: "music" },
] as const satisfies readonly { id: ScreenId; label: string; icon: IconName }[];

export function App() {
  const [scale, setScale] = useState(fitScale);
  const [screen, setScreen] = useState(savedScreen);
  useEffect(() => {
    const onResize = () => setScale(fitScale());
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, []);

  const pick = (id: ScreenId) => {
    setScreen(id);
    localStorage.setItem(SCREEN_KEY, id);
  };
  const control = useFrameControl(pick);
  useEffect(() => {
    if (!control.buildChanged) return;
    const timer = setInterval(() => {
      if (isIdle() || !control.screenOn) prefetchThenReload();
    }, 10_000);
    return () => clearInterval(timer);
  }, [control.buildChanged, control.screenOn]);

  return (
    <div class="stage" style={`transform:scale(${scale})`}>
      <main class="screen" hidden={screen !== "calendar"}>
        <Calendar />
      </main>
      {screen === "music" && (
        <main class="screen">
          <NowPlaying />
        </main>
      )}
      <ScreenMenu screen={screen} onPick={pick} />
      {!control.screenOn && (
        <button
          class="sleep"
          aria-label="Wake"
          onClick={() => control.send({ type: "screen", on: true })}
        />
      )}
    </div>
  );
}

function ScreenMenu({
  screen,
  onPick,
}: {
  screen: ScreenId;
  onPick: (id: ScreenId) => void;
}) {
  const [open, setOpen] = useState(false);
  const { time, period } = clockParts(useNow());
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), 30_000);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <div class={`menu${open ? " is-open" : ""}`}>
      <div class="menu-scrim" onClick={() => setOpen(false)} />
      <button
        class="menu-btn"
        aria-label="Screens"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span class="num">{time}</span>
        {period && <span class="label">{period}</span>}
        <Icon name="down" size={20} />
      </button>
      <nav class="menu-list" aria-hidden={!open}>
        {SCREENS.map(({ id, label, icon }) => (
          <button
            key={id}
            class={`menu-item${id === screen ? " is-on" : ""}`}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              onPick(id);
              setOpen(false);
            }}
          >
            <Icon name={icon} size={26} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function savedScreen(): ScreenId {
  const saved = localStorage.getItem(SCREEN_KEY);
  return SCREENS.find(({ id }) => id === saved)?.id ?? "calendar";
}

function fitScale(): number {
  return Math.min(innerWidth / STAGE_WIDTH, innerHeight / STAGE_HEIGHT);
}
