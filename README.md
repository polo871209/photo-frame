# Frame dashboard

A wall dashboard for a 1280×800 Android photo frame. The first screen is a Google Calendar view with day, 4-day, week, month and schedule modes. It runs on Cloudflare Workers. The worker reads Google Calendar iCal feeds, and the client is Preact, built for Android System WebView 106.

## Run it locally

```sh
mise install
mise exec -- pnpm install
mise exec -- pnpm dev
```

`pnpm dev` passes the variables in `.mise.toml` (git ignores it) to the local worker. Open `http://localhost:5173/`. The dev server skips the client certificate check and listens on every interface (`server.host: true`), so anyone on the network can read the calendar while it runs.

Without a calendar configuration, the worker returns sample events and the header shows "Sample events".

## Only the frame can read the calendar

The frame proves itself with a TLS client certificate (mTLS). The worker runs first on every path (`run_worker_first: true`) and answers 404 unless Cloudflare reports a valid, unrevoked certificate (`request.cf.tlsClientAuth`). The page, its assets and the API all look absent to anyone else. Nothing secret travels in the URL or in a cookie.

- **Certificates:** Cloudflare issues them from the account's managed CA, under **SSL/TLS → Client Certificates** for `lochingpo.com`. mTLS is on for the host `photoframe.lochingpo.com` only. To lock out a device, revoke its certificate there.
- **New device:** make an ECDSA P-256 key and CSR on the Mac, then create a certificate with **Use my private key and CSR**. Copy the certificate PEM on the result page, because Cloudflare does not show it again. The frame's files and install command are in `device/README.md`.
- **Other hosts:** `workers_dev` and `preview_urls` are off in `wrangler.jsonc`. On a `workers.dev` host Cloudflare asks for no certificate, so the worker would answer 404 there anyway.

## Connect Google Calendar

The worker reads each calendar's secret iCal address. Nobody needs to sign in, and the frame holds no Google token.

1. In Google Calendar on the web, open **Settings**, select the calendar, and copy **Secret address in iCal format**.
2. Repeat for each calendar. Pick a color for each one.
3. For local development, put the list in `.mise.toml` under `[env]`:

   ```toml
   CALENDARS = '[{"name":"Family","url":"https://calendar.google.com/calendar/ical/.../basic.ics","color":"#D20F39"}]'
   ```

4. For production, store the same JSON as a secret:

   ```sh
   mise exec -- pnpm exec wrangler secret put CALENDARS
   ```

To add a calendar later, store it as its own secret whose name starts with `CALENDARS_`, for example `wrangler secret put CALENDARS_BRENDA` with a one-item JSON array. Wrangler cannot read a secret back, so this leaves the other calendars untouched. The worker reads `CALENDARS` and every `CALENDARS_*` secret in name order.

Do not commit the iCal addresses. Anyone with the address can read the calendar.

To hide a calendar or change its color, tap the sliders button at the top right of the frame. Each device stores these choices in its own `localStorage`, keyed by calendar name. The color in `CALENDARS` is the default, and its swatch is the first one in each row. The other swatches are the [Catppuccin Latte](https://catppuccin.com/palette) accents, which keep white text readable.

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
