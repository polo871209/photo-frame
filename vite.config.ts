import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// Vite loads this file once per environment. A process-wide value keeps the client and the worker on one build ID.
const processWide = globalThis as { frameBuildId?: string };
processWide.frameBuildId ??= new Date().toISOString();

// The frame runs Android System WebView 106. cssTarget stays at chrome61 because that WebView
// rejects 4- and 8-digit hex colours, which newer targets let the minifier emit.
export default defineConfig({
  plugins: [cloudflare()],
  define: { __BUILD_ID__: JSON.stringify(processWide.frameBuildId) },
  build: { target: "chrome106", cssTarget: "chrome61" },
  server: { host: true },
});
