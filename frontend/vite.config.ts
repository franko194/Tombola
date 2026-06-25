import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { networkInterfaces } from "node:os";

const DEV_PORT = 5173;

function getLanAppUrl() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return `http://${address.address}:${DEV_PORT}`;
      }
    }
  }
  return "";
}

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_DEV_LAN_APP_URL": JSON.stringify(getLanAppUrl()),
  },
  server: {
    port: DEV_PORT,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: DEV_PORT,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
