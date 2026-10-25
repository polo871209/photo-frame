const IDLE_MS = 3 * 60_000;

let lastTouch = Date.now();
addEventListener("pointerdown", () => (lastTouch = Date.now()), true);

export function isIdle(): boolean {
  return Date.now() - lastTouch >= IDLE_MS;
}
