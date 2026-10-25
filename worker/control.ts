import { DurableObject } from "cloudflare:workers";
import { BUILD_ID } from "../shared/build";
import {
  DEFAULT_SETTINGS,
  parseCommand,
  PING,
  PONG,
  type ControlStatus,
  type FrameCommand,
  type FrameMessage,
  type FrameSettings,
} from "../shared/control";

const SETTINGS_KEY = "settings";

/** One instance holds the frame's settings and its WebSockets, and pushes every command at once. */
export class FrameControl extends DurableObject {
  private screenshotWaiters = new Set<(image: ArrayBuffer) => void>();

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify(await this.stateMessage()));
    return new Response(null, { status: 101, webSocket: client });
  }

  async status(): Promise<ControlStatus> {
    return {
      settings: await this.settings(),
      frames: this.ctx.getWebSockets().length,
    };
  }

  async command(command: FrameCommand): Promise<ControlStatus> {
    if (command.type === "set") {
      const settings = { ...(await this.settings()), ...command.settings };
      await this.ctx.storage.put(SETTINGS_KEY, settings);
      this.broadcast(await this.stateMessage());
    } else {
      this.broadcast(command);
    }
    return this.status();
  }

  /** Asks the frame for a screenshot and waits for it. Null if no frame answers in time. */
  async screenshot(): Promise<ArrayBuffer | null> {
    let deliver!: (image: ArrayBuffer) => void;
    const image = new Promise<ArrayBuffer>((resolve) => (deliver = resolve));
    this.screenshotWaiters.add(deliver);
    const stopWaiting = new AbortController();
    const timeout = scheduler
      .wait(20_000, { signal: stopWaiting.signal })
      .then(() => null);
    this.broadcast({ type: "screenshot" });
    try {
      return await Promise.race([image, timeout]);
    } finally {
      stopWaiting.abort();
      this.screenshotWaiters.delete(deliver);
    }
  }

  receiveScreenshot(image: ArrayBuffer) {
    for (const deliver of this.screenshotWaiters) deliver(image);
    this.screenshotWaiters.clear();
  }

  async webSocketMessage(_socket: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }
    const command = parseCommand(parsed);
    if (command) await this.command(command);
  }

  async webSocketClose(socket: WebSocket, code: number) {
    socket.close(code === 1005 ? 1000 : code);
  }

  private async settings(): Promise<FrameSettings> {
    const stored =
      await this.ctx.storage.get<Partial<FrameSettings>>(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  private async stateMessage(): Promise<FrameMessage> {
    return { type: "state", build: BUILD_ID, settings: await this.settings() };
  }

  private broadcast(message: FrameMessage) {
    const text = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(text);
      } catch {
        socket.close(1011);
      }
    }
  }
}
