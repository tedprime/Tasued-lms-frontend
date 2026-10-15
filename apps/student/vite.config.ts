import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // MSW and Workbox cannot both control the app at the same service-worker scope.
        disable: env.VITE_USE_MOCKS === "true",
        registerType: "autoUpdate",
        injectRegister: "auto",
        // MSW owns the service worker in development, so the PWA worker is build-only.
        devOptions: { enabled: false },
        includeAssets: ["favicon.png", "apple-touch-icon.png"],
        manifest: {
          name: "TASFUED LMS",
          short_name: "TASFUED LMS",
          description: "Classes, recordings, course text, assignments, quizzes and forum for TASFUED students.",
          theme_color: "#192f59",
          background_color: "#f7f8fa",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
            { src: "maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          globIgnores: ["mockServiceWorker.js"],
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/api\//],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          runtimeCaching: [
            {
              // Lets the app shell start offline (the guard needs a session).
              urlPattern: /\/api\/v1\/auth\/session$/,
              handler: "NetworkFirst",
              options: { cacheName: "api-session", networkTimeoutSeconds: 5, cacheableResponse: { statuses: [200] } },
            },
            {
              urlPattern: /\/api\/v1\/offerings\/[^/?]+(\?.*)?$/,
              handler: "NetworkFirst",
              options: { cacheName: "api-offerings", networkTimeoutSeconds: 6, expiration: { maxEntries: 60 }, cacheableResponse: { statuses: [0, 200] } },
            },
            {
              // Unit pages (course text) open offline once visited.
              urlPattern: /\/api\/v1\/units\/[^/?]+(\?.*)?$/,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-units",
                networkTimeoutSeconds: 6,
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /\/api\/v1\/offerings\/[^/]+\/modules(\?.*)?$/,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-modules",
                networkTimeoutSeconds: 6,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: [
        // Keep hls.js out of the startup chunk: the app's "@tasued/ui" resolves to a barrel without
        // VideoPlayer; the unit page imports VideoPlayer directly (src/lib/video-player.ts).
        { find: /^@tasued\/ui$/, replacement: fileURLToPath(new URL("./src/lib/ui-shim.ts", import.meta.url)) },
        // Dev-only: @tasued/editor's CustomImageNode trips Lexical's unoptimised-dev-build invariant
        // ("must implement a static importJSON"), crashing every editor in `vite dev`. The production
        // build (used by `vite build`) doesn't run that check, so serve it in dev too until fixed upstream.
        ...(command === "serve"
          ? [{ find: /^lexical$/, replacement: fileURLToPath(new URL("../../node_modules/lexical/dist/Lexical.prod.mjs", import.meta.url)) }]
          : []),
      ],
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 5173 },
  };
});
