import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // REST
      "^/(health|users|auth|me|auctions|bids)": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      // WebSocket (Socket.IO)
      "/socket.io": {
        target: "http://localhost:8080",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
