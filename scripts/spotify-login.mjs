import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

const REDIRECT_URI = "http://127.0.0.1:8888/callback";
const SCOPES =
  "user-read-playback-state user-read-currently-playing user-read-recently-played user-modify-playback-state playlist-read-private user-top-read";
const toProduction = process.argv.includes("--production");

const { SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret } =
  process.env;
if (!clientId || !clientSecret) {
  console.error(
    "Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .mise.toml under [env], then run this through mise exec.",
  );
  process.exit(1);
}

const state = randomBytes(16).toString("hex");
const authorizeUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams(
  {
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
  },
)}`;

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", REDIRECT_URI);
  if (url.pathname !== "/callback") {
    response.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  if (url.searchParams.get("state") !== state || !code) {
    const reason = url.searchParams.get("error") ?? "state mismatch";
    response.end(`Spotify login failed: ${reason}`);
    console.error(`Spotify login failed: ${reason}`);
    process.exit(1);
  }
  const refreshToken = await exchange(code);
  await run("mise", [
    "set",
    "--file",
    ".mise.toml",
    `SPOTIFY_REFRESH_TOKEN=${refreshToken}`,
  ]);
  console.log("Wrote SPOTIFY_REFRESH_TOKEN to .mise.toml.");
  if (toProduction) await uploadSecrets(refreshToken);
  response.end("Spotify is connected. You can close this tab.");
  server.close();
});

server.listen(8888, "127.0.0.1", () => {
  console.log(`Open this page if no browser opened:\n${authorizeUrl}`);
  execFile("open", [authorizeUrl]);
});

async function exchange(code) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!response.ok) {
    console.error(`Spotify token HTTP ${response.status}`);
    process.exit(1);
  }
  return (await response.json()).refresh_token;
}

function uploadSecrets(refreshToken) {
  return run(
    "pnpm",
    ["exec", "wrangler", "secret", "bulk"],
    JSON.stringify({
      SPOTIFY_CLIENT_ID: clientId,
      SPOTIFY_CLIENT_SECRET: clientSecret,
      SPOTIFY_REFRESH_TOKEN: refreshToken,
    }),
  );
}

function run(command, args, input = "") {
  const child = spawn(command, args, {
    stdio: ["pipe", "inherit", "inherit"],
  });
  child.stdin.end(input);
  return new Promise((resolve, reject) =>
    child.on("exit", (status) =>
      status === 0
        ? resolve()
        : reject(new Error(`${command} ${args[0]} exited ${status}`)),
    ),
  );
}
