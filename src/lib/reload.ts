/** Loads the new build's files into the HTTP cache, then reloads, so the reload paints at once. */
export async function prefetchThenReload() {
  try {
    const page = await fetch("/");
    if (!page.ok) return;
    const assets = (await page.text()).match(/\/assets\/[^"]+/g) ?? [];
    const files = await Promise.all(assets.map((url) => fetch(url)));
    if (!files.every((file) => file.ok)) return;
    await Promise.all(files.map((file) => file.arrayBuffer()));
  } catch {
    return;
  }
  location.reload();
}
