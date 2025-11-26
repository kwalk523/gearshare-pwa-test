import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",

      manifest: {
        name: "Gear Share Prototype Simulation",
        short_name: "Gear Share",
        description: "Rent, lend, and share gear easily",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#ffffff",
        background_color: "#ffffff",

        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/maskable-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
      },

      devOptions: {
        enabled: true, // test PWA in dev mode
      },
    }),
  ],

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
