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
import { playChime } from "../lib/chime";
import { prefetchThenReload } from "../lib/reload";

declare global {
  interface Window {
    /** Added by the Home HQ kiosk 1.3-mtls and later (`device/homehq.patch`). Absent in a desktop browser. */
    Kiosk?: {
      /** 0 powers the backlight off. */
      setBrightness(level: number): void;
      /** 0 mutes, and 1 is the maximum. */
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
  /** Applies settings on this frame only, for example while a slider moves. */
  preview: (settings: Partial<FrameSettings>) => void;
  /** The worker runs a newer deploy than this page. */
  buildChanged: boolean;
  send: (command: FrameCommand) => void;
}

/** Keeps a WebSocket open to `/api/control` and applies what the worker pushes. */
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
          case "chime":
            playChime();
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

  const level = settings.screenOn ? settings.brightness : 0;
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

  return { settings, preview, buildChanged, send };
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
