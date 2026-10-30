export const SCREEN_IDS = ["calendar", "music", "weather", "garden"] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

/** Settings the worker keeps and sends to every frame when they change or a frame connects. */
export interface FrameSettings {
  screenOn: boolean;
  /** Backlight level while the screen is on, above 0 and at most 1. */
  brightness: number;
  /** Media volume. 0 mutes it, and 1 is the maximum. */
  volume: number;
  /** Show the garden after a while with no touch, and on the music screen only while Spotify does not play. */
  screensaver: boolean;
  /** Turn the screen off every night from `nightStart` to `nightEnd`, both `HH:MM` in the frame's local time. A tap wakes it until the frame is idle again. */
  night: boolean;
  nightStart: string;
  nightEnd: string;
  /** Switch to the dark theme at `darkStart` and back to the light theme at `darkEnd`, both `HH:MM` in the frame's local time. */
  dark: boolean;
  darkStart: string;
  darkEnd: string;
}

export const DEFAULT_SETTINGS: FrameSettings = {
  screenOn: true,
  brightness: 0.8,
  volume: 0.33,
  screensaver: true,
  night: false,
  nightStart: "23:00",
  nightEnd: "07:00",
  dark: false,
  darkStart: "21:00",
  darkEnd: "07:00",
};

/** Sent as JSON to `POST /api/control`, or by the frame over its `/api/control` WebSocket. */
export type FrameCommand =
  | { type: "set"; settings: Partial<FrameSettings> }
  | { type: "show"; screen: ScreenId }
  | { type: "reload" }
  | { type: "restart" };

/** What the worker sends to the frame over the WebSocket, as JSON. */
export type FrameMessage =
  | { type: "state"; build: string; settings: FrameSettings }
  | { type: "screenshot" }
  | Exclude<FrameCommand, { type: "set" }>;

/** The answer to `GET` and `POST /api/control`. `frames` counts the open WebSockets. */
export interface ControlStatus {
  settings: FrameSettings;
  frames: number;
}

/** The frame sends this text every `HEARTBEAT_MS`, and the worker answers `"pong"` without waking. */
export const PING = "ping";
export const PONG = "pong";
export const HEARTBEAT_MS = 25_000;

export const COMMAND_SHAPES = [
  `{"type":"set","settings":{"screenOn"?:boolean,"brightness"?:number in (0,1],"volume"?:number in [0,1],"screensaver"?:boolean,"night"?:boolean,"nightStart"?:"HH:MM","nightEnd"?:"HH:MM","dark"?:boolean,"darkStart"?:"HH:MM","darkEnd"?:"HH:MM"}}`,
  `{"type":"show","screen":${SCREEN_IDS.map((id) => `"${id}"`).join("|")}}`,
  `{"type":"reload"}`,
  `{"type":"restart"}`,
];

export function parseCommand(value: unknown): FrameCommand | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const command = value as Record<string, unknown>;
  if (command.type === "set") {
    const settings = parseSettings(command.settings);
    return settings && { type: "set", settings };
  }
  if (
    command.type === "show" &&
    SCREEN_IDS.includes(command.screen as ScreenId)
  ) {
    return { type: "show", screen: command.screen as ScreenId };
  }
  if (command.type === "reload" || command.type === "restart") {
    return { type: command.type };
  }
  return undefined;
}

const isBoolean = (value: unknown) => typeof value === "boolean";
const isClockTime = (value: unknown) =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const SETTING_CHECKS: {
  [K in keyof FrameSettings]: (value: unknown) => boolean;
} = {
  screenOn: isBoolean,
  brightness: (value) => typeof value === "number" && value > 0 && value <= 1,
  volume: (value) => typeof value === "number" && value >= 0 && value <= 1,
  screensaver: isBoolean,
  night: isBoolean,
  nightStart: isClockTime,
  nightEnd: isClockTime,
  dark: isBoolean,
  darkStart: isClockTime,
  darkEnd: isClockTime,
};

function parseSettings(value: unknown): Partial<FrameSettings> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const entries = Object.entries(value);
  const valid = entries.every(
    ([key, setting]) =>
      Object.hasOwn(SETTING_CHECKS, key) &&
      SETTING_CHECKS[key as keyof FrameSettings](setting),
  );
  return entries.length && valid ? Object.fromEntries(entries) : undefined;
}
