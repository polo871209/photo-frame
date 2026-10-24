import { useEffect, useRef, useState } from "preact/hooks";
import { BUILD_ID } from "../../shared/build";
import {
  HEARTBEAT_MS,
  PING,
  PONG,
  type FrameCommand,
  type FrameMessage,
  type ScreenId,
} from "../../shared/control";
import { prefetchThenReload } from "../lib/reload";

declare global {
  interface Window {
    /** Added by the Home HQ kiosk 1.2-mtls and later. Absent in a desktop browser. */
    HomeHQ?: { setBacklight(on: boolean): void };
  }
}

const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
const SILENT_LIMIT_MS = HEARTBEAT_MS + 10_000;

export interface FrameControl {
  screenOn: boolean;
  /** The worker runs a newer deploy than this page. */
  buildChanged: boolean;
  send: (command: FrameCommand) => void;
}

/** Keeps a WebSocket open to `/api/control` and applies what the worker pushes. */
export function useFrameControl(
  onShow: (screen: ScreenId) => void,
): FrameControl {
  const [screenOn, setScreenOn] = useState(true);
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
        if (message.type === "state") {
          setScreenOn(message.settings.screenOn);
          setBuildChanged(message.build !== BUILD_ID);
        } else if (message.type === "show") {
          show.current(message.screen);
        } else {
          prefetchThenReload();
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

  useEffect(() => window.HomeHQ?.setBacklight(screenOn), [screenOn]);

  const send = (command: FrameCommand) => {
    if (command.type === "screen") setScreenOn(command.on);
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(command));
    }
  };

  return { screenOn, buildChanged, send };
}
