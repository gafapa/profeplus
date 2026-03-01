import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function normalizeBasePath(rawBase?: string): string {
  const candidate = (rawBase || "/").trim();
  const withLeading = candidate.startsWith("/") ? candidate : `/${candidate}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const base = normalizeBasePath(env.VITE_BASE_PATH);

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        injectRegister: "auto",
        strategies: "generateSW",
        registerType: "autoUpdate",
        includeAssets: ["pwa-icon.svg"],
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,json}"],
          navigateFallback: "index.html",
          maximumFileSizeToCacheInBytes: 7 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true
        },
        manifest: {
          id: base,
          name: "ProfePlus",
          short_name: "ProfePlus",
          description: "Cuaderno digital docente inspirado en iDoceo y Additio.",
          theme_color: "#1f4b99",
          background_color: "#f5f7fb",
          display: "standalone",
          display_override: ["standalone", "minimal-ui", "browser"],
          orientation: "portrait-primary",
          start_url: base,
          scope: base,
          categories: ["education", "productivity"],
          prefer_related_applications: false,
          icons: [
            {
              src: "pwa-icon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any maskable"
            }
          ]
        }
      })
    ]
  };
});
