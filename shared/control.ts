export const SCREEN_IDS = ["calendar", "music", "weather"] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

/** Settings the worker keeps and sends to every frame when they change or a frame connects. */
export interface FrameSettings {
  screenOn: boolean;
  /** Backlight level while the screen is on, above 0 and at most 1. */
  brightness: number;
  /** Media volume, which chimes play at. 0 mutes it, and 1 is the maximum. */
  volume: number;
  /** Play a chime before each timed event of a shown calendar. */
  chimes: boolean;
}

export const DEFAULT_SETTINGS: FrameSettings = {
  screenOn: true,
  brightness: 0.8,
  volume: 0.33,
  chimes: true,
};

/** Sent as JSON to `POST /api/control`, or by the frame over its `/api/control` WebSocket. */
export type FrameCommand =
  | { type: "set"; settings: Partial<FrameSettings> }
  | { type: "show"; screen: ScreenId }
  | { type: "reload" }
  | { type: "restart" }
  | { type: "chime" };

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
  `{"type":"set","settings":{"screenOn"?:boolean,"brightness"?:number in (0,1],"volume"?:number in [0,1],"chimes"?:boolean}}`,
  `{"type":"show","screen":${SCREEN_IDS.map((id) => `"${id}"`).join("|")}}`,
  `{"type":"reload"}`,
  `{"type":"restart"}`,
  `{"type":"chime"}`,
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
  if (
    command.type === "reload" ||
    command.type === "restart" ||
    command.type === "chime"
  ) {
    return { type: command.type };
  }
  return undefined;
}

function parseSettings(value: unknown): Partial<FrameSettings> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { screenOn, brightness, volume, chimes, ...rest } = value as Record<
    string,
    unknown
  >;
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
  if (typeof chimes === "boolean") settings.chimes = chimes;
  else if (chimes !== undefined) return undefined;
  return Object.keys(settings).length ? settings : undefined;
}
