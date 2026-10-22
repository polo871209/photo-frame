# Frame dashboard

A wall dashboard for one Android photo frame. The calendar is the first screen. The repo is `polo871209/photo-frame`.

## Read device/README.md before any work on the frame

`device/README.md` records the frame itself: identity, partition map, how root works, every change made so far with its undo, and what is not done yet (WebView 138, more swap). `device/` also holds the scripts that did the work.

- Run ADB through mise (`mise exec -- adb`). `mise.toml` pins it.
- Reads on the frame are fine. Ask the owner before every write to the frame, flash or settings, even if the same write was approved before.
- Before a flash write, make sure that a verified backup exists, that the target has the expected hash, and that the undo is written down. Read the result back.
- After any change on the frame, add it to `device/README.md` with its undo. Keep serial numbers out of the repo, and keep backups in `backups/`, which git ignores.
- The public record of the same work is [PR #235](https://github.com/wesbos/photo-frame-dashboard/pull/235) to `wesbos/photo-frame-dashboard`. If you learn something that other owners of this board need, add it to that PR's `docs/hy-s101-rk3326.md` on the `hy-s101-record` branch of `polo871209/photo-frame-dashboard`, and ask the owner before you push.

## The target device sets every limit

The frame is an HY-S101 (Rockchip RK3326, Android 8.1 Go, about 976 MB RAM, 32-bit ARM). Every change must keep working on it.

- **Browser:** Android System WebView 106. `vite.config.ts` sets `build.target: chrome106` and `cssTarget: chrome61`. Keep `cssTarget` at `chrome61`, because WebView 106 rejects the 4- and 8-digit hex colors that newer targets let the minifier write.
- **CSS:** write flat CSS. Use `rgb(var(--c-rgb) / .12)` for tints. Nesting, `color-mix()`, `oklch()` and `dvh` units do not work in WebView 106.
- **Screen:** 1280×800 at 160 dpi, touch only. `src/App.tsx` draws a fixed 1280×800 `.stage` and scales it to the window, so lay out in fixed pixels for that size. Hover states never show. Tap targets are at least `--tap` (52px).
- **Memory and CPU:** the frame is slow. Keep the bundle small (now 26 KB JS, 10 KB gzipped), add a dependency only when it removes real work, and avoid animations that run all the time.
- **Unattended:** nobody presses reload. Every fetch must fail soft and retry on the next refresh. `index.html` reloads the page if the bundle did not mount within 10 s.

## Time zone follows the system

The frame's system time zone is `Asia/Kuala_Lumpur` (`getprop persist.sys.timezone`). The app follows the system time zone and hard-codes none.

- The client does all date math in local time with `Date` and the helpers in `src/lib/dates.ts`. Format through `format` in that file, which uses `Intl` with the default locale and time zone.
- The client asks for `/api/events?from&to` with local midnights as ISO instants. The worker returns timed events as UTC instants and all-day events as `YYYY-MM-DD` with an exclusive end (`shared/events.ts`). Parse all-day dates with `parseLocalDate`, never `new Date("YYYY-MM-DD")`, because that parses as UTC midnight.
- `worker/ics.ts` resolves each event's own `TZID` through the feed's `VTIMEZONE` blocks. The worker never uses its own time zone, which is UTC on Cloudflare.
- Test time-zone work with `timezoneId: "Asia/Kuala_Lumpur"`, as `scripts/screenshots.mjs` does. To find bugs that only show in other zones, run it once more with another `timezoneId`.

## Layout of the code

- `worker/`: the Cloudflare Worker. It runs first on every path (`run_worker_first: true` in `wrangler.jsonc`), checks the key, serves `/api/*` itself and passes everything else to the static assets.
- `shared/`: types used by both the worker and the client. Change the API contract here first.
- `src/calendar/`: the calendar screen. `views.ts` is the one list of views and owns each view's range, step and title. `prefs.ts` keeps each device's hidden calendars and color choices in `localStorage`, and `SettingsSheet.tsx` edits them. `layout.ts` places overlapping timed events in columns and packs all-day bars into rows.
- `src/styles/`: `tokens.css` (colors, fonts, sizes), `base.css` (controls shared by all screens), and one file per screen.

New screens (tasks, weather, photos) go in `src/<screen>/` with their own CSS file, and their data routes go under `/api/<screen>` in the worker.

## Calendar data comes from iCal feeds

The worker reads Google Calendar through each calendar's secret iCal address. There is no OAuth and no Google token on the frame.

- The `CALENDARS` variable is a JSON array of `{name, url, color}`. In development it lives in `.dev.vars`, and in production it is a Wrangler secret. If `CALENDARS` is unset, the worker returns sample events from `worker/sample.ts`, and the header shows "Sample events".
- Every path needs the key, as `?key=` or as the `frame_key` cookie that a valid `?key=` sets. Otherwise the worker answers 404, and the same happens when `FRAME_KEY` is unset. `worker/index.ts` checks it before it serves assets through `env.ASSETS`. The production key is in `.mise.toml` under `[env]` (git ignores it). Never print it, log it or commit it.
- The iCal addresses are secrets, because anyone with one can read the calendar. Keep them out of commits, logs, screenshots and error messages. `failed` in the response lists calendar names only.
- Feeds are cached for 300 s at the edge, and the client refetches every 5 min. Expansion stops at 5000 occurrences for each feed, and a request can cover at most 70 days.
- Recurrence goes through `ical.js`. Keep recurrence exceptions (`RECURRENCE-ID`), `EXDATE` and `STATUS:CANCELLED` working. Test a change in `worker/ics.ts` against a feed that has all three.

## Style comes from the old dashboard

The look follows the `dashboard/` folder in `wesbos/photo-frame-dashboard`: warm paper background, ink text, Archivo (variable width) for text and numbers, Instrument Serif for titles. Event blocks are solid fills in the calendar's color.

- Take colors from `tokens.css`. An element that shows a calendar color gets `--c` and `--c-rgb` through `colorVars(hex)` in `src/calendar/model.ts`.
- Numbers use `.num` (narrow, heavy, tabular). Small caps labels use `.label`.
- The time grid sizes an hour so 7 AM to 11 PM fills the view, and opens at 7 AM. The rest of the day scrolls (`useFittedHours` in `TimeGrid.tsx`).
- After 3 min with no touch, the calendar goes back to the week view and today (`IDLE_RESET_MS` in `Calendar.tsx`).

## Make sure that a change works before you commit

Run commands through mise, for example `mise exec -- pnpm check`. The package manager is pnpm, and the scripts are in `package.json`.

1. Run `pnpm check`. It type-checks the client and the worker with separate configurations.
2. Run `pnpm build`.
3. Make sure that `.dev.vars` has `FRAME_KEY=local-dev`. Start `pnpm dev`, then run `pnpm screenshots "http://localhost:5173/?key=local-dev"`. It opens each view in Google Chrome at 1280×800 and writes PNGs to `screenshots/`, which git ignores. It exits non-zero on any page error. Look at every PNG.
4. If you changed CSS or a dependency, run `grep -oE "#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{8}\b" dist/client/assets/*.css`. It must print nothing.

Chrome on the Mac is newer than WebView 106. A screenshot that passes does not prove that the frame renders the page. If a change uses a CSS or JS feature newer than Chrome 106, check it on caniuse.com or on the frame itself.

## Deploy only when the owner asks

`pnpm run deploy` builds and publishes to Cloudflare at `https://photoframe.lochingpo.com`, and the frame gets the new version when the page reloads. Ask the owner before you deploy. Before you change `CALENDARS` in production with `wrangler secret put`, ask too.

After you change `wrangler.jsonc`, run `pnpm types` to regenerate `worker-configuration.d.ts`.
