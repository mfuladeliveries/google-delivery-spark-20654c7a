import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // 'prompt' prevents the SW from silently activating + reloading the page
      // when the user returns from background. We control updates ourselves.
      registerType: "prompt",
      injectRegister: null, // we register manually in main.tsx with iframe/preview guards
      devOptions: {
        enabled: false,
      },
      includeAssets: ["favicon.ico", "placeholder.svg"],
      workbox: {
        // Don't precache HTML — that's what causes "reload on resume" because
        // Workbox detects a new index.html hash and triggers skipWaiting.
        globPatterns: ["**/*.{js,css,ico,png,svg,jpg,jpeg,webp}"],
        navigateFallbackDenylist: [/^\/~oauth/],
        importScripts: ["/push-handler.js"],
        // Don't take control of pages that were loaded before the SW activated.
        clientsClaim: false,
        skipWaiting: false,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: "Mfula Deliveries",
        short_name: "Mfula",
        description:
          "Order food from KFC, McDonald's, Debonnairs and more — delivered to Mfuleni & surrounds.",
        theme_color: "#ff6600",
        background_color: "#fafafa",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
