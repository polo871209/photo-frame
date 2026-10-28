import { useEffect, useRef, useState } from "preact/hooks";
import { BUILD_ID } from "../../shared/build";
import {
  DEFAULT_SETTINGS,
  HEARTBEAT_MS,
  PING,
  PONG,
  type FrameCommand,
  type FrameMessage,
  type FrameSettings,
  type ScreenId,
} from "../../shared/control";
import { minutesIntoDay, minutesOfClockTime } from "../lib/dates";
import { isIdle } from "../lib/idle";
import { prefetchThenReload } from "../lib/reload";
import { applyTheme } from "../lib/theme";
import { useNow } from "../lib/useNow";

declare global {
  interface Window {
    /** Added by the Home HQ kiosk 1.3-mtls and later (`device/homehq.patch`). Absent in a desktop browser. */
    Kiosk?: {
      setBrightness(level: number): void;
      setVolume(level: number): void;
      restart(): void;
      /** Answers with a `kiosk-screenshot` event whose detail is a base64 JPEG, or "" on failure. */
      screenshot(): void;
    };
  }
}

const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
const SILENT_LIMIT_MS = HEARTBEAT_MS + 10_000;

export interface FrameControl {
  settings: FrameSettings;
  /** Whether the screen shows now: `settings.screenOn`, unless the night window has turned it off. */
  screenOn: boolean;
  wake: () => void;
  preview: (settings: Partial<FrameSettings>) => void;
  buildChanged: boolean;
  send: (command: FrameCommand) => void;
}

export function useFrameControl(
  onShow: (screen: ScreenId) => void,
): FrameControl {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [buildChanged, setBuildChanged] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const show = useRef(onShow);
  show.current = onShow;

  useEffect(() => {
    let retryMs = FIRST_RETRY_MS;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let stopped = false;

    const connect = () => {
      const scheme = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${scheme}://${location.host}/api/control`);
      socket.current = ws;
      let heardAt = Date.now();

      const reconnect = () => {
        ws.onclose = ws.onmessage = null;
        ws.close();
        clearInterval(heartbeat);
        if (stopped) return;
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      };

      ws.onopen = () => (retryMs = FIRST_RETRY_MS);
      ws.onclose = reconnect;
      ws.onmessage = ({ data }) => {
        heardAt = Date.now();
        if (data === PONG) return;
        const message = JSON.parse(data) as FrameMessage;
        switch (message.type) {
          case "state":
            setSettings(message.settings);
            setBuildChanged(message.build !== BUILD_ID);
            break;
          case "show":
            show.current(message.screen);
            break;
          case "reload":
            prefetchThenReload();
            break;
          case "restart":
            restartKiosk();
            break;
          case "screenshot":
            uploadScreenshot();
            break;
        }
      };
      heartbeat = setInterval(() => {
        if (Date.now() - heardAt > SILENT_LIMIT_MS) reconnect();
        else if (ws.readyState === WebSocket.OPEN) ws.send(PING);
      }, HEARTBEAT_MS);
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearInterval(heartbeat);
      socket.current?.close();
    };
  }, []);

  const now = useNow();
  const night =
    settings.night && inWindow(now, settings.nightStart, settings.nightEnd);
  const [nightWake, setNightWake] = useState(false);
  useEffect(() => {
    if (!nightWake) return;
    if (!night) {
      setNightWake(false);
      return;
    }
    const timer = setInterval(() => {
      if (isIdle()) setNightWake(false);
    }, 10_000);
    return () => clearInterval(timer);
  }, [night, nightWake]);
  const screenOn = settings.screenOn && (!night || nightWake);

  const darkTime = inWindow(now, settings.darkStart, settings.darkEnd);
  useEffect(() => {
    if (settings.dark) applyTheme(darkTime ? "dark" : "light");
  }, [settings.dark, darkTime]);

  const level = screenOn ? settings.brightness : 0;
  useEffect(() => window.Kiosk?.setBrightness(level), [level]);
  useEffect(() => window.Kiosk?.setVolume(settings.volume), [settings.volume]);

  const preview = (changes: Partial<FrameSettings>) =>
    setSettings((current) => ({ ...current, ...changes }));

  const send = (command: FrameCommand) => {
    if (command.type === "set") preview(command.settings);
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(command));
    }
  };

  const wake = () => {
    if (night) setNightWake(true);
    if (!settings.screenOn) send({ type: "set", settings: { screenOn: true } });
  };

  return { settings, screenOn, wake, preview, buildChanged, send };
}

function inWindow(now: Date, start: string, end: string): boolean {
  const minute = minutesIntoDay(now);
  const from = minutesOfClockTime(start);
  const to = minutesOfClockTime(end);
  return from <= to
    ? from <= minute && minute < to
    : minute >= from || minute < to;
}

export function restartKiosk() {
  if (window.Kiosk) window.Kiosk.restart();
  else location.reload();
}

function uploadScreenshot() {
  const kiosk = window.Kiosk;
  if (!kiosk) return;
  addEventListener(
    "kiosk-screenshot",
    (event) => {
      const jpeg = (event as CustomEvent<string>).detail;
      if (!jpeg) return;
      fetch(`data:image/jpeg;base64,${jpeg}`)
        .then((response) => response.blob())
        .then((image) =>
          fetch("/api/control/screenshot", { method: "PUT", body: image }),
        )
        .catch(() => undefined);
    },
    { once: true },
  );
  kiosk.screenshot();
}
