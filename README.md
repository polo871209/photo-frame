# Frame dashboard

A wall dashboard for a 1280×800 Android photo frame. The first screen is a Google Calendar view with day, 4-day, week, month and schedule modes. It runs on Cloudflare Workers. The worker reads Google Calendar iCal feeds, and the client is Preact, built for Android System WebView 106.

## Run it locally

```sh
mise install
mise exec -- pnpm install
mise exec -- pnpm dev
```

`pnpm dev` passes the variables in `.mise.toml` (git ignores it) to the local worker, so the local key is the production `FRAME_KEY`. Open `http://localhost:5173/?key=<FRAME_KEY>`.

Without a calendar configuration, the worker returns sample events and the header shows "Sample events".

## Only the frame can read the calendar

The worker runs first on every path (`run_worker_first: true`). A request without the key gets 404, so the page, its assets and the API all look absent. The kiosk opens `https://photoframe.lochingpo.com/?key=<FRAME_KEY>`. A valid `?key=` sets the HttpOnly cookie `frame_key`, and the page's own asset and API requests send that cookie. If `FRAME_KEY` is not set, every request gets 404.

The production key is 32 random bytes in base64url. It lives in the Wrangler secret `FRAME_KEY`, in the owner's secret manager, and in `.mise.toml` (git ignores it) under `[env]`. Never commit it. To make a new key and send it to Cloudflare:

```sh
openssl rand 32 | base64 | tr '+/' '-_' | tr -d '=\n'   # put the output in .mise.toml as FRAME_KEY
mise exec -- sh -c 'printf %s "$FRAME_KEY" | pnpm exec wrangler secret put FRAME_KEY'
```

After a new key, give the kiosk the new URL (see `device/README.md`).

## Connect Google Calendar

The worker reads each calendar's secret iCal address. Nobody needs to sign in, and the frame holds no Google token.

1. In Google Calendar on the web, open **Settings**, select the calendar, and copy **Secret address in iCal format**.
2. Repeat for each calendar. Pick a color for each one.
3. For local development, put the list in `.mise.toml` under `[env]`:

   ```toml
   CALENDARS = '[{"name":"Family","url":"https://calendar.google.com/calendar/ical/.../basic.ics","color":"#D8321F"}]'
   ```

4. For production, store the same JSON as a secret:

   ```sh
   mise exec -- pnpm exec wrangler secret put CALENDARS
   ```

Do not commit the iCal addresses. Anyone with the address can read the calendar.

To hide a calendar or change its color, tap the sliders button at the top right of the frame. Each device stores these choices in its own `localStorage`, keyed by calendar name. The color in `CALENDARS` is the default, and its swatch is the first one in each row.

If a feed fails, the other calendars still show and the header names the calendar that did not load. The worker caches each feed for 30 seconds, and the client refreshes every 30 seconds.

## Check and deploy

```sh
mise exec -- pnpm check    # type-checks the client and the worker
mise exec -- pnpm build
mise exec -- pnpm run deploy
```

The worker serves <https://photoframe.lochingpo.com> (`routes` in `wrangler.jsonc`). Use `pnpm run deploy`, because `pnpm deploy` is a pnpm command and does not run the script. The deploy runs `pnpm check` first.

The frame picks up a deploy by itself. It reloads the page once the server reports a new build and nobody has touched the screen for 3 minutes. `AGENTS.md` describes how.

## Rules for changes

`AGENTS.md` lists the device limits (WebView 106, 1280×800 touch screen, time zone) and the checks to run before a commit.
