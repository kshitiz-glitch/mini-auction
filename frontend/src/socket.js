// frontend/src/socket.js
import { io } from "socket.io-client";

export function createSocket() {
  // connect to the same origin the page is served from (http://localhost:5173)
  // Vite will proxy /socket.io to http://localhost:8080
  const socket = io("/", {
    path: "/socket.io",
    transports: ["websocket"],           // avoid long-polling flaps
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
  });

  socket.on("connect_error", (err) => {
    // keep it quiet; connection will retry
    console.debug("[socket] connect_error", err?.message || err);
  });

  return socket;
}
