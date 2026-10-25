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
