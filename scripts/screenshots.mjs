import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5173/";
const outDir = new URL("../screenshots/", import.meta.url).pathname;
const views = ["Day", "4 Days", "Week", "Month", "Schedule"];
const themes = ["light", "dark"];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
for (const theme of themes) await shoot(theme);
await browser.close();

console.log(
  `Wrote ${themes.length * (views.length + 4)} screenshots to ${outDir}`,
);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

async function shoot(theme) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    timezoneId: "Asia/Kuala_Lumpur",
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const path = (name) => `${outDir}${theme}-${name}.png`;

  await page.goto(url);
  await page.waitForSelector(".cal");
  if (theme === "dark") {
    await page.click(".menu-btn");
    await page.click(".menu-theme");
    await page.click(".menu-scrim");
  }
  await page.waitForLoadState("networkidle");
  for (const view of views) {
    await page.click(`.seg button:text-is("${view}")`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path(view.replace(" ", "")) });
  }
  await page.click('.seg button:text-is("Week")');
  await page.locator(".ev").first().click();
  await page.waitForSelector(".sheet");
  await page.screenshot({ path: path("EventSheet") });
  await page.click(".sheet-x");
  await page.click('.icon-btn[aria-label="Settings"]');
  await page.waitForSelector(".set-cal");
  await page.screenshot({ path: path("Settings") });
  await page.click(".sheet-head .icon-btn");
  await page.click(".menu-btn");
  await page.waitForTimeout(300);
  await page.screenshot({ path: path("Menu") });
  await page.click('.menu-item:text-is("Music")');
  await page.waitForSelector(".music-info");
  await page.waitForTimeout(300);
  await page.screenshot({ path: path("Music") });
  await page.click(".menu-btn");
  await page.click('.menu-item:text-is("Calendar")');
  await page.close();
}
