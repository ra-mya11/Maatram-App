import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: process.env["MAATRAM_API_PROXY"] || "http://127.0.0.1:4000",
        changeOrigin: true,
      },
      "/uploads": {
        target: process.env["MAATRAM_API_PROXY"] || "http://127.0.0.1:4000",
        changeOrigin: true,
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (SSR error wrapper).
    server: { entry: "server" },
  },
  nitro: {
    preset: process.env["VERCEL"] ? "vercel" : process.env["NITRO_PRESET"] || "node-server",
  },
});
