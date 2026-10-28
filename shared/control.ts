export const SCREEN_IDS = ["calendar", "music", "weather", "garden"] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

/** Settings the worker keeps and sends to every frame when they change or a frame connects. */
export interface FrameSettings {
  screenOn: boolean;
  /** Backlight level while the screen is on, above 0 and at most 1. */
  brightness: number;
  /** Media volume. 0 mutes it, and 1 is the maximum. */
  volume: number;
  /** Show the garden after a while with no touch, on every screen but music. */
  screensaver: boolean;
  /** Turn the screen off every night from `nightStart` to `nightEnd`, both `HH:MM` in the frame's local time. A tap wakes it until the frame is idle again. */
  night: boolean;
  nightStart: string;
  nightEnd: string;
}

export const DEFAULT_SETTINGS: FrameSettings = {
  screenOn: true,
  brightness: 0.8,
  volume: 0.33,
  screensaver: true,
  night: false,
  nightStart: "23:00",
  nightEnd: "07:00",
};

const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  `{"type":"set","settings":{"screenOn"?:boolean,"brightness"?:number in (0,1],"volume"?:number in [0,1],"screensaver"?:boolean,"night"?:boolean,"nightStart"?:"HH:MM","nightEnd"?:"HH:MM"}}`,
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

function parseSettings(value: unknown): Partial<FrameSettings> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const {
    screenOn,
    brightness,
    volume,
    screensaver,
    night,
    nightStart,
    nightEnd,
    ...rest
  } = value as Record<string, unknown>;
  if (Object.keys(rest).length) return undefined;
  const settings: Partial<FrameSettings> = {};
  if (typeof screenOn === "boolean") settings.screenOn = screenOn;
  else if (screenOn !== undefined) return undefined;
  if (typeof brightness === "number" && brightness > 0 && brightness <= 1) {
    settings.brightness = brightness;
  } else if (brightness !== undefined) return undefined;
  if (typeof volume === "number" && volume >= 0 && volume <= 1) {
    settings.volume = volume;
  } else if (volume !== undefined) return undefined;
  if (typeof screensaver === "boolean") settings.screensaver = screensaver;
  else if (screensaver !== undefined) return undefined;
  if (typeof night === "boolean") settings.night = night;
  else if (night !== undefined) return undefined;
  if (typeof nightStart === "string" && CLOCK_TIME.test(nightStart)) {
    settings.nightStart = nightStart;
  } else if (nightStart !== undefined) return undefined;
  if (typeof nightEnd === "string" && CLOCK_TIME.test(nightEnd)) {
    settings.nightEnd = nightEnd;
  } else if (nightEnd !== undefined) return undefined;
  return Object.keys(settings).length ? settings : undefined;
}
