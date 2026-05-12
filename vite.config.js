import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/airbnb-manager/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Meus Flats",
        short_name: "Flats",
        description: "Gestão dos flats Airbnb - Reservas e Diárias",
        theme_color: "#7c3aed",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/airbnb-manager/",
        scope: "/airbnb-manager/",
        categories: ["productivity"],
        screenshots: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            form_factor: "narrow"
          }
        ],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 20 }
            }
          }
        ]
      }
    })
  ]
});
