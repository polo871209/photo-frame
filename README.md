# Frame dashboard

A wall dashboard for a 1280×800 Android photo frame. The first screen is a Google Calendar view with day, 4-day, week, month and schedule modes. It runs on Cloudflare Workers. The worker reads Google Calendar iCal feeds, and the client is Preact, built for Android System WebView 106.

## Run it locally

```sh
mise install
mise exec -- npm install
mise exec -- npm run dev
```

Open <http://localhost:5173>. Without a calendar configuration, the worker returns sample events and the header shows "Sample events".

## Connect Google Calendar

The worker reads each calendar's secret iCal address. Nobody needs to sign in, and the frame holds no Google token.

1. In Google Calendar on the web, open **Settings**, select the calendar, and copy **Secret address in iCal format**.
2. Repeat for each calendar. Pick a color for each one.
3. For local development, put the list in `.dev.vars` (git ignores it):

   ```sh
   CALENDARS='[{"name":"Family","url":"https://calendar.google.com/calendar/ical/.../basic.ics","color":"#D8321F"}]'
   ```

4. For production, store the same JSON as a secret:

   ```sh
   mise exec -- npx wrangler secret put CALENDARS
   ```

Do not commit the iCal addresses. Anyone with the address can read the calendar.

If a feed fails, the other calendars still show and the header names the calendar that did not load. The worker caches each feed for 5 minutes, and the client refreshes every 5 minutes.

## Check and deploy

```sh
mise exec -- npm run check    # type-checks the client and the worker
mise exec -- npm run build
mise exec -- npm run deploy
```

## Rules for changes

`AGENTS.md` lists the device limits (WebView 106, 1280×800 touch screen, time zone) and the checks to run before a commit.
