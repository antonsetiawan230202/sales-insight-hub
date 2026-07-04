import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Standalone SPA build for the Electron desktop bundle.
// This bypasses TanStack Start / nitro and produces a plain client-side
// bundle that Electron can load via file://.
export default defineConfig({
  base: "./",
  root: path.resolve(__dirname, "electron"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "electron-dist"),
    emptyOutDir: true,
    target: "es2022",
  },
});
