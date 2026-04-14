// socketServer.js
import { Server } from "socket.io";
import { createServer } from "http";

const SOCKET_PORT = process.env.SOCKET_PORT || 4000;

// Create a basic HTTP server for Socket.io
const socketServer = createServer();

export const io = new Server(socketServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://hr-internship-management-system.vercel.app"
    ],
    methods: ["GET", "POST"],
  },
});

if (process.env.NODE_ENV !== "test") {
  socketServer.listen(SOCKET_PORT, () => {
    console.log(`Socket.io server listening on port ${SOCKET_PORT}`);
  });
}

// You can add your Socket.io event handlers here, or import them from another file
// Example:
 io.on("connection", (socket) => {
   console.log("A user connected: " + socket.id);
 });
