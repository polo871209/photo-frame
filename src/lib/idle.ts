let lastTouch = Date.now();
addEventListener("pointerdown", () => (lastTouch = Date.now()), true);

export const IDLE_MS = 3 * 60_000;

export function isIdle(afterMs = IDLE_MS): boolean {
  return Date.now() - lastTouch >= afterMs;
}
