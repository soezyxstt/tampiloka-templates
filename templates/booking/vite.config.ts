import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: { __PUBLIC_DEMO__: JSON.stringify(mode === "demo") },
  server: {
    host: "0.0.0.0",
    port: 5176,
    strictPort: true,
  },
  build: { target: "es2022" },
}));
