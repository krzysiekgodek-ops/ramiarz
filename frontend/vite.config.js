import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Statyczny manifest.webmanifest jest już w public/ i podlinkowany w index.html
      manifest: false,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // SPA: nawigacje (deep linki react-router) serwuj z precache'owanego index.html.
        // index.html jest precache'owany z rewizją, a stare wpisy są czyszczone przy
        // aktywacji SW — dlatego nie może wrócić błąd ze starym hashem JS.
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
