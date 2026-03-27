import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000"
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(process.cwd(), "index.html"),
        demo: path.resolve(process.cwd(), "demo.html")
      }
    }
  }
});
