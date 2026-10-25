export const SCREEN_IDS = ["calendar", "music", "weather"] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

/** Settings the worker keeps and sends to every frame when they change or a frame connects. */
export interface FrameSettings {
  screenOn: boolean;
}

/** Sent as JSON to `POST /api/control`, or by the frame over its `/api/control` WebSocket. */
export type FrameCommand =
  | { type: "screen"; on: boolean }
  | { type: "show"; screen: ScreenId }
  | { type: "reload" };

/** What the worker sends to the frame over the WebSocket, as JSON. */
export type FrameMessage =
  | { type: "state"; build: string; settings: FrameSettings }
  | Exclude<FrameCommand, { type: "screen" }>;

/** The answer to `GET` and `POST /api/control`. `frames` counts the open WebSockets. */
export interface ControlStatus {
  settings: FrameSettings;
  frames: number;
}

/** The frame sends this text every `HEARTBEAT_MS`, and the worker answers `"pong"` without waking. */
export const PING = "ping";
export const PONG = "pong";
export const HEARTBEAT_MS = 25_000;

export function parseCommand(value: unknown): FrameCommand | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const command = value as Record<string, unknown>;
  if (command.type === "screen" && typeof command.on === "boolean") {
    return { type: "screen", on: command.on };
  }
  if (
    command.type === "show" &&
    SCREEN_IDS.includes(command.screen as ScreenId)
  ) {
    return { type: "show", screen: command.screen as ScreenId };
  }
  if (command.type === "reload") return { type: "reload" };
  return undefined;
}
