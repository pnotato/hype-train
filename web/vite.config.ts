import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: Vite serves the client and proxies /api to the Go server.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:8080" },
  },
});
