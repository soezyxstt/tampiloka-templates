import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: { __PUBLIC_DEMO__: JSON.stringify(mode === "demo") },
  server: {
    host: "0.0.0.0",
    port: 5176,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq, req) => {
            if (req.headers.origin)
              proxyReq.setHeader("Origin", "http://127.0.0.1:8788");
          });
        },
      },
    },
  },
  build: { target: "es2022" },
}));
