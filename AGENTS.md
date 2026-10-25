# Frame dashboard

A wall dashboard for one Android photo frame. The calendar is the first screen. The repo is `polo871209/photo-frame`.

Run every command through mise, for example `mise exec -- pnpm check` or `mise exec -- adb devices`. `mise.toml` pins the tools.

## Read device/README.md before any work on the frame

`device/README.md` records the frame: identity, partition map, how root works, every change so far with its undo, and what is not done yet. Its "Rules for any work on the frame" bind every write. `device/` also holds the scripts that did the work.

- Reads on the frame are fine. Ask the owner before every write to the frame, flash or settings, even if the same write was approved before. The kiosk APK install in [Deploy after every change](#deploy-after-every-change) needs no question.
- After any change on the frame, add it to `device/README.md` with its undo.
- The public record of the same work is [PR #235](https://github.com/wesbos/photo-frame-dashboard/pull/235) to `wesbos/photo-frame-dashboard`. If you learn something that other owners of this board need, add it to that PR's `docs/hy-s101-rk3326.md` on the `hy-s101-record` branch of `polo871209/photo-frame-dashboard`, and ask the owner before you push.

## The target device sets every limit

The frame is an HY-S101 (Rockchip RK3326, Android 8.1 Go, about 976 MB RAM, 32-bit ARM). Every change must keep working on it.

- **Browser:** Android System WebView 106. `vite.config.ts` sets `build.target: chrome106` and `cssTarget: chrome61`. Keep `cssTarget` at `chrome61`, because WebView 106 rejects the 4- and 8-digit hex colors that newer targets let the minifier write.
- **CSS:** write flat CSS. Use `rgb(var(--c-rgb) / .12)` for tints. Nesting, `color-mix()`, `oklch()` and `dvh` units do not work in WebView 106.
- **Screen:** 1280×800 at 160 dpi, touch only. `src/App.tsx` draws a fixed 1280×800 `.stage` and scales it to the window, so lay out in fixed pixels for that size. Hover states never show. Tap targets are at least `--tap` (52px).
- **Memory and CPU:** the frame is slow. Keep the bundle small (now 52 KB JS, 19 KB gzipped, as `pnpm build` prints), add a dependency only when it removes real work, and avoid animations that run all the time.
- **Unattended:** nobody presses reload. Every fetch must fail soft and retry on the next refresh. `index.html` reloads the page if the bundle did not mount within 10 s.

## Time zone follows the system

The frame's system time zone is `Asia/Kuala_Lumpur` (`getprop persist.sys.timezone`). The app follows the system time zone and hard-codes none.

- The client does all date math in local time with `Date` and the helpers in `src/lib/dates.ts`. Format through `format` in that file, which uses `Intl` with the default locale and time zone.
- The client asks for `/api/events?from&to` with local midnights as ISO instants. The worker returns timed events as UTC instants and all-day events as `YYYY-MM-DD` with an exclusive end (`shared/events.ts`). Parse all-day dates with `parseLocalDate`, never `new Date("YYYY-MM-DD")`, because that parses as UTC midnight.
- `worker/ics.ts` resolves each event's own `TZID` through the feed's `VTIMEZONE` blocks. The worker never uses its own time zone, which is UTC on Cloudflare.
- Test time-zone work with `timezoneId: "Asia/Kuala_Lumpur"`, as `scripts/screenshots.mjs` does. To find bugs that only show in other zones, run it once more with another `timezoneId`.

## Layout of the code

- `worker/`: the Cloudflare Worker. It runs first on every path (`run_worker_first: true` in `wrangler.jsonc`), checks the client certificate, serves `/api/*` itself and passes everything else to the static assets.
- `shared/`: types used by both the worker and the client. Change the API contract here first.
- `src/App.tsx`: the stage and the list of screens. The open screen is saved in `localStorage` (`frame.screen`).
- `src/menu/Menu.tsx`: the top right of every screen. Icon buttons for the screens sit left of the clock, and a tap on the clock opens the device settings: brightness, volume, dark mode, event chimes, screen off and restart. Each screen gets the full 1280×800, so keep the top right `--menu-w` wide and `--head-h` high free of controls, and size a screen's own header row with `--head-h`. `--menu-w` in `tokens.css` fits three screen buttons, so widen it when you add a screen.
- `src/calendar/`: the calendar screen. `views.ts` is the one list of views and owns each view's range, step and title. `prefs.ts` keeps each device's hidden calendars, color choices and home view in `localStorage`. `SettingsSheet.tsx` edits the calendars, and the view switcher sets the home view. `layout.ts` places overlapping timed events in columns and packs all-day bars into rows.
- `src/control/useFrameControl.ts`: the WebSocket that receives pushed commands. See [Push commands to the frame](#push-commands-to-the-frame).
- `src/music/`: the music screen. It shows the track that plays on the owner's Spotify account, on any device, and the next tracks in the queue.
- `src/weather/`: the weather screen for SS2, Petaling Jaya. It shows the air quality nearby, the 7-day forecast, and the summary and hours of today or the tapped day.
- `src/styles/`: `tokens.css` (colors, fonts, sizes), `base.css` (controls shared by all screens), and one file per screen.

New screens (tasks, photos) go in `src/<screen>/` with their own CSS file, and their data routes go under `/api/<screen>` in the worker. Add each screen to `SCREENS` in `src/App.tsx`. Screen space is the limit, so a screen has no rounded corners or padding that it does not need.

## Calendar data comes from iCal feeds

The worker reads Google Calendar through each calendar's secret iCal address. There is no OAuth and no Google token on the frame.

- The `CALENDARS` variable is a JSON array of `{name, url, color}`. In development it lives in `.mise.toml` under `[env]`, and in production it is a Wrangler secret. If `CALENDARS` is unset, the worker returns sample events from `worker/sample.ts`, and the header shows "Sample events".
- Every path needs a TLS client certificate from the account's Cloudflare-managed CA. `hasClientCertificate` in `worker/index.ts` checks it before it serves assets through `env.ASSETS`, and answers 404 without one. `pnpm dev` skips the check (`import.meta.env.DEV`), and no other path may skip it. The frame's private key is in `~/.config/photo-frame/mtls/`. Never print it, log it or commit it. `README.md` and section 7 of `device/README.md` describe how to issue and install a certificate.
- The iCal addresses are secrets, because anyone with one can read the calendar. Keep them out of commits, logs, screenshots and error messages. `failed` in the response lists calendar names only.
- Feeds are cached for 30 s at the edge, and the client refetches every 30 s. Expansion stops at 5000 occurrences for each feed, and a request can cover at most 70 days.
- Recurrence goes through `ical.js`. Keep recurrence exceptions (`RECURRENCE-ID`), `EXDATE` and `STATUS:CANCELLED` working. Test a change in `worker/ics.ts` against a feed that has all three.

## Music comes from the Spotify Web API

The worker reads the owner's playback through the Spotify Web API (`worker/spotify.ts`). The frame holds no Spotify token.

- The worker needs `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REFRESH_TOKEN`. In development they live in `.mise.toml` under `[env]`, and in production they are Wrangler secrets. If one is unset, `/api/spotify` returns a sample track, and the screen shows "Sample track".
- To get the refresh token, put the client ID and secret of the owner's Spotify app in `.mise.toml`, then run `pnpm spotify-login`. It saves the token to `.mise.toml`. The app must list the redirect URI `http://127.0.0.1:8888/callback`. With `--production`, the script also uploads the three secrets. Ask the owner before you run it with that flag.
- Since February 2026, Development Mode allows one Spotify app for each developer and needs Premium. Before you call another endpoint, make sure that the [February 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) still lists it.
- The client secret and the refresh token are secrets like the iCal addresses. Keep them out of commits, logs, screenshots and error messages.
- The worker calls `GET /me/player` and `GET /me/player/queue`. When nothing plays, it also calls `GET /me/player/recently-played` and shows the last played track. The token's scopes are `SCOPES` in `scripts/spotify-login.mjs`. After you add a scope, the owner must run the login again.
- `POST /api/spotify/control` takes a `PlayerCommand` (`shared/spotify.ts`). If no device is active, a play command goes to the first device in `GET /me/player/devices`. The Web API cannot jump into the queue, so `skipTo` sends `POST /me/player/next` once for each track before the picked one.
- `GET /api/spotify/suggestions` feeds the picker. "Jump back in" is the playlists and albums of the last 50 played tracks, and "Your top songs" is `GET /me/top/tracks` for the last 4 weeks. Spotify answers 404 for the metadata of its own mixes (`spotify:playlist:37i9…`) in Development Mode, so they show as "Spotify mix".
- The music screen polls `/api/spotify` only while it is open: every 5 s while a track plays, and every 15 s otherwise.
- Lyrics come from LRCLIB, not Spotify, because the Web API has no lyrics. `GET /api/spotify/lyrics?uri=` reads the track with `GET /tracks/{id}`, then asks LRCLIB (`worker/lyrics.ts`). LRCLIB needs no key and wants a User-Agent that names the app. It answers 503 and 429 now and then, and it rate-limits Cloudflare's shared addresses, so the worker retries twice, keeps each answer in `caches.default` for 7 days, and the client retries every 15 s. The lyrics toggle state is in `localStorage` (`frame.lyrics`).

## Weather comes from Open-Meteo, the DOE and AirGradient

`GET /api/weather` (`worker/weather.ts`) reads three public sources that need no key. The frame stands in SS2, Petaling Jaya. `FORECAST_PLACE` and `AIR_SITES` at the top of that file name each place and the source nearest to it.

- The forecast for SS2 comes from the [Open-Meteo forecast API](https://open-meteo.com/en/docs). The worker asks with `timezone=auto`, so daily values follow the place's days, and turns hourly times into UTC instants with `utc_offset_seconds`.
- The air block shows SS2 large, then TTDI and Bangsar as rows. SS2 and Bangsar have no sensor of their own. SS2 uses DOE station CA19B (SK Bandar Utama, 2 km away), and Bangsar uses DOE Cheras (CA16W, 5 km away). Each row names its source.
- DOE readings are Malaysia's Air Pollutant Index, read from the undocumented ArcGIS layer `CAQM_MCAQM_Current_Reading` behind [APIMS](https://eqms.doe.gov.my/APIMS/main). A station sometimes has no reading for an hour, and then its `API` is `null`.
- TTDI is the mean PM2.5 in µg/m³ of AirGradient sensors 86311 and 211198, from the AirGradient public API. It uses the US EPA PM2.5 bands, not the Malaysian API.
- Keep the station and sensor readings. Open-Meteo's air quality API is a model, and in October 2026 it read US AQI 113 when the KL stations read 80 and 94.
- The worker caches each source for 10 min at the edge, and the screen polls every 10 min while it is open. If a source fails, its part of the response is `null`, and the client keeps that part's last answer.
- Each day button at the bottom opens that day: its summary and its 6 AM to 9 PM hours. After 3 min with no touch, the screen goes back to today (`isIdle`).

## Style comes from the old dashboard

The layout follows the `dashboard/` folder in `wesbos/photo-frame-dashboard`: flat background, ink text, and solid event blocks in the calendar's color. All text and numbers use Fira Sans. Fira Sans has no width axis, so narrow text takes a separate family: `--condensed` (Fira Sans Condensed) for labels and buttons, `--narrow` (Fira Sans Extra Condensed) for `.num`. `src/main.tsx` imports each weight on its own, so import a new weight there before you use it.

- Colors come from [Catppuccin](https://catppuccin.com/palette): Latte for the light theme and Macchiato for the dark theme. `tokens.css` maps them to `--paper`, `--ink` and the other tokens, once under `:root` and once under `:root[data-theme="dark"]`. The "Dark" and "Light" item in the screen menu toggles the theme (`src/lib/theme.ts`) and saves it in `localStorage` (`frame.theme`). An inline script in `index.html` applies the saved theme before the bundle loads, so a reload in the dark theme does not flash light.
- Take colors from `tokens.css`, and make sure that each change looks right in both themes. `pnpm screenshots` writes a `light-` and a `dark-` PNG for each view. Calendar colors stay as the feed or the device's color choice sets them. An element that shows a calendar color gets `--c` and `--c-rgb` through `colorVars(hex)` in `src/calendar/model.ts`.
- Numbers use `.num` (narrow, heavy, tabular). Small caps labels use `.label`. Titles use `.title`.
- The time grid sizes an hour so 7 AM to 11 PM fills the view, and opens at 7 AM. The rest of the day scrolls (`useFittedHours` in `TimeGrid.tsx`).
- The calendar opens in the home view, which is the view last picked in the view switcher (week on a new device). After 3 min with no touch on any screen, it goes back to the home view and today (`isIdle` in `src/lib/idle.ts`). Tapping a day to open it does not change the home view.

## Make sure that a change works before you commit

1. Run `pnpm check`.
2. Run `pnpm build`.
3. Start `pnpm dev`, then run `pnpm screenshots`. The `dev` script sets `CLOUDFLARE_INCLUDE_PROCESS_ENV=true`, so the local worker reads its variables from `.mise.toml` through mise. There is no `.dev.vars`. If a `.dev.vars` exists, Wrangler reads only that file. `pnpm screenshots` opens `localhost:5173`. It opens each view in Google Chrome at 1280×800 and writes PNGs to `screenshots/`, which git ignores. It exits non-zero on any page error. Look at every PNG.
4. If you changed CSS or a dependency, run `grep -oE "#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{8}\b" dist/client/assets/*.css`. It must print nothing.

Chrome on the Mac is newer than WebView 106. A screenshot that passes does not prove that the frame renders the page. If a change uses a CSS or JS feature newer than Chrome 106, check it on caniuse.com or on the frame itself.

## Deploy after every change

When a change passes the checks above, run `pnpm run deploy` without asking the owner. It publishes the worker and its assets to `https://photoframe.lochingpo.com` as one version.

The frame reloads itself after a deploy, with no ADB and no hand:

1. `vite.config.ts` puts one build ID (the build time) into both the client and the worker.
2. A deploy restarts the `FrameControl` Durable Object, which closes the frame's WebSocket. The frame reconnects, and the first message carries the worker's build ID.
3. If that ID differs from the page's own, `App.tsx` reloads the page once nobody has touched the frame for 3 min (`isIdle`), or at once while the screen is off. `prefetchThenReload` in `src/lib/reload.ts` loads the new files into the cache first, so the reload does not show a blank page.

An untouched frame runs the new version within about 15 s of the deploy. Keep this chain working in every change, because without it a deploy reaches the frame only by hand.

The worker serves every file under `/assets/` with `Cache-Control: private, max-age=31536000, immutable`, so the frame fetches only the files whose content hash changed. Add files there only through imports that Vite hashes, never through `public/assets/`.

If the change is to the kiosk APK itself, install the APK as section 7 of `device/README.md` describes. ADB reaches the frame over Wi-Fi after `mise exec -- adb connect 192.168.68.73:5555` (section 8). If that fails and no USB cable is in, tell the owner that the frame still runs the old APK.

Ask the owner before you change `CALENDARS` in production with `wrangler secret put`.

After you change `wrangler.jsonc`, run `pnpm types` to regenerate `worker-configuration.d.ts`.

## Push commands to the frame

The frame keeps a WebSocket open to `/api/control`, and the `FrameControl` Durable Object (`worker/control.ts`) pushes each command to it at once. Commands change only the page, the kiosk app and the backlight, so they need no question to the owner. Push them from the Mac with `pnpm frame`:

- `pnpm frame status` prints the settings and `frames`, the number of open WebSockets. `frames: 0` means that the frame is offline or reconnecting.
- `pnpm frame screen off` shows a black screen and powers the backlight off. `pnpm frame screen on` undoes it, and so does a tap on the black screen. `pnpm frame brightness 1-100` sets the backlight while the screen is on, and `pnpm frame volume 0-100` sets the media volume. These settings survive reloads and deploys, and the device settings on the frame change the same ones.
- `pnpm frame show calendar|music|weather` opens a screen. `pnpm frame reload` reloads the page at once, and `pnpm frame restart` restarts the kiosk app, which also drops WebView's TLS sessions. The kiosk restarts itself every night at 04:00.
- `pnpm frame chimes on|off` turns the chime 5 min before each timed event on or off (`src/calendar/useChimes.ts`). Chimes are silent while the screen is off. `pnpm frame chime` plays one chime to test the speaker.
- `pnpm frame screenshot` saves what the frame shows to `screenshots/frame-<time>.jpg`, through `/api/control/screenshot`.

The script sends the frame's client certificate from `~/.config/photo-frame/mtls/`. `FRAME_URL=http://localhost:5173 pnpm frame …` targets `pnpm dev`.

To add a command, add it to `FrameCommand` and `parseCommand` in `shared/control.ts`, then handle it in `useFrameControl.ts`. Keep state that must survive a reconnect in `FrameSettings`, because the worker sends it on every connect. Backlight, volume, restart and screenshot go through `window.Kiosk`, which the kiosk adds from version 1.4-mtls (`device/homehq.patch`). In a desktop browser, `screen off` shows only the black screen, `restart` reloads the page, and `screenshot` gets no answer.
