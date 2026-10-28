let lastTouch = Date.now();
addEventListener("pointerdown", () => (lastTouch = Date.now()), true);

export function isIdle(afterMs = 3 * 60_000): boolean {
  return Date.now() - lastTouch >= afterMs;
}
