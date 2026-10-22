import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5173/";
const outDir = new URL("../screenshots/", import.meta.url).pathname;
const views = ["Day", "4 Days", "Week", "Month", "Schedule"];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  timezoneId: "Asia/Kuala_Lumpur",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto(url);
await page.waitForSelector(".cal");
await page.waitForLoadState("networkidle");
for (const view of views) {
  await page.click(`.seg button:text-is("${view}")`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}${view.replace(" ", "")}.png` });
}
await page.click('.seg button:text-is("Week")');
await page.locator(".ev").first().click();
await page.waitForSelector(".sheet");
await page.screenshot({ path: `${outDir}EventSheet.png` });
await browser.close();

console.log(`Wrote ${views.length + 1} screenshots to ${outDir}`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
