import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // MSW and Workbox cannot both control the app at the same service-worker scope.
        disable: env.VITE_USE_MOCKS === "true",
        registerType: "autoUpdate",
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.js",
        injectRegister: "auto",
        // MSW owns the service worker in development, so the PWA worker is build-only.
        devOptions: { enabled: false },
        includeAssets: ["favicon.png", "apple-touch-icon.png"],
        manifest: {
          name: "TASFUED LMS Staff",
          short_name: "TASFUED LMS Staff",
          description: "TASFUED LMS staff administration and notifications.",
          theme_color: "#192f59",
          background_color: "#f7f8fa",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          globIgnores: ["mockServiceWorker.js"],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
      }),
    ],
    server: { port: 5174, strictPort: true },
    preview: { port: 5174 },
  };
});
