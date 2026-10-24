import { useEffect, useState } from "preact/hooks";
import { Calendar } from "./calendar/Calendar";
import { Icon, type IconName } from "./icons";
import { clockParts } from "./lib/dates";
import { useNow } from "./lib/useNow";
import { NowPlaying } from "./music/NowPlaying";

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 800;
const SCREEN_KEY = "frame.screen";

const SCREENS = [
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "music", label: "Music", icon: "music" },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];

type ScreenId = (typeof SCREENS)[number]["id"];

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

  return (
    <div class="stage" style={`transform:scale(${scale})`}>
      <nav class="rail">
        {SCREENS.map(({ id, label, icon }) => (
          <button
            key={id}
            class={`rail-btn${id === screen ? " is-on" : ""}`}
            aria-label={label}
            onClick={() => pick(id)}
          >
            <Icon name={icon} size={26} />
          </button>
        ))}
        <RailClock />
      </nav>
      <main class="screen" hidden={screen !== "calendar"}>
        <Calendar />
      </main>
      {screen === "music" && (
        <main class="screen">
          <NowPlaying />
        </main>
      )}
    </div>
  );
}

function RailClock() {
  const { time, period } = clockParts(useNow());
  return (
    <div class="rail-clock">
      <span class="num">{time}</span>
      {period && <span class="label">{period}</span>}
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
