import { useEffect, useState } from "preact/hooks";
import type { ScreenId } from "../shared/control";
import { Calendar } from "./calendar/Calendar";
import { useFrameControl } from "./control/useFrameControl";
import { isIdle } from "./lib/idle";
import { prefetchThenReload } from "./lib/reload";
import { Menu, type ScreenEntry } from "./menu/Menu";
import { NowPlaying } from "./music/NowPlaying";
import { Weather } from "./weather/Weather";

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 800;
const SCREEN_KEY = "frame.screen";

const SCREENS = [
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "music", label: "Music", icon: "music" },
  { id: "weather", label: "Weather", icon: "cloudSun" },
] as const satisfies readonly ScreenEntry[];

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
  const { screenOn } = control.settings;
  useEffect(() => {
    if (!control.buildChanged) return;
    const timer = setInterval(() => {
      if (isIdle() || !screenOn) prefetchThenReload();
    }, 10_000);
    return () => clearInterval(timer);
  }, [control.buildChanged, screenOn]);

  return (
    <div class="stage" style={`transform:scale(${scale})`}>
      <main class="screen" hidden={screen !== "calendar"}>
        <Calendar chimes={control.settings.chimes && screenOn} />
      </main>
      {screen === "music" && (
        <main class="screen">
          <NowPlaying />
        </main>
      )}
      {screen === "weather" && (
        <main class="screen">
          <Weather />
        </main>
      )}
      <Menu screens={SCREENS} screen={screen} onPick={pick} control={control} />
      {!screenOn && (
        <button
          class="sleep"
          aria-label="Wake"
          onClick={() =>
            control.send({ type: "set", settings: { screenOn: true } })
          }
        />
      )}
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
