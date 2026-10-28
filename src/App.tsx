import { useEffect, useState } from "preact/hooks";
import { SCREEN_IDS, type ScreenId } from "../shared/control";
import { Calendar } from "./calendar/Calendar";
import { useFrameControl } from "./control/useFrameControl";
import { Garden } from "./garden/Garden";
import { SaverInfo, Screensaver } from "./garden/Screensaver";
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

  const [gardenControls, setGardenControls] = useState(false);
  const pick = (id: ScreenId) => {
    setScreen(id);
    setGardenControls(false);
    localStorage.setItem(SCREEN_KEY, id);
  };
  const control = useFrameControl(pick);
  const { screenOn } = control;
  useEffect(() => {
    if (!control.buildChanged) return;
    const timer = setInterval(() => {
      if (isIdle() || !screenOn) prefetchThenReload();
    }, 10_000);
    return () => clearInterval(timer);
  }, [control.buildChanged, screenOn]);

  const [saving, setSaving] = useState(false);
  const canSave =
    control.settings.screensaver &&
    screenOn &&
    screen !== "music" &&
    screen !== "garden";
  useEffect(() => {
    if (!canSave) {
      setSaving(false);
      return;
    }
    const timer = setInterval(() => {
      if (isIdle()) setSaving(true);
    }, 5_000);
    return () => clearInterval(timer);
  }, [canSave]);

  useEffect(() => {
    if (!gardenControls) return;
    const timer = setInterval(() => {
      if (isIdle(60_000)) setGardenControls(false);
    }, 5_000);
    return () => clearInterval(timer);
  }, [gardenControls]);
  const gardenQuiet = screen === "garden" && !gardenControls;

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
      {screen === "weather" && (
        <main class="screen">
          <Weather />
        </main>
      )}
      {screen === "garden" && screenOn && (
        <main
          class="screen"
          onPointerDownCapture={() => setGardenControls(true)}
        >
          <Garden controls={gardenControls} />
          {!gardenControls && <SaverInfo />}
        </main>
      )}
      {!gardenQuiet && (
        <Menu
          screens={SCREENS}
          screen={screen}
          onPick={pick}
          control={control}
        />
      )}
      {saving && <Screensaver onClose={() => setSaving(false)} />}
      {!screenOn && (
        <button class="sleep" aria-label="Wake" onClick={control.wake} />
      )}
    </div>
  );
}

function savedScreen(): ScreenId {
  const saved = localStorage.getItem(SCREEN_KEY);
  return SCREEN_IDS.find((id) => id === saved) ?? "calendar";
}

function fitScale(): number {
  return Math.min(innerWidth / STAGE_WIDTH, innerHeight / STAGE_HEIGHT);
}
