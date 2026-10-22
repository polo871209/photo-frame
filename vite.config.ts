import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

// The frame runs Android System WebView 106. cssTarget stays at chrome61 because that WebView
// rejects 4- and 8-digit hex colours, which newer targets let the minifier emit.
export default defineConfig({
  plugins: [cloudflare()],
  build: { target: 'chrome106', cssTarget: 'chrome61' },
  server: { host: true },
});
