import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  const onlineUsers = new Map<string, string>(); // socket.id -> userId
  const userSockets = new Map<string, Set<string>>(); // userId -> Set of socket.ids
  const userLocations = new Map<string, string>(); // userId -> location name

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("user_login", (userId) => {
      if (!userId) return;
      onlineUsers.set(socket.id, userId);
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId)!.add(socket.id);
      
      // Broadcast that this user is online
      io.emit("user_status", { userId, status: "online" });
      
      // Send current locations to the new user
      const locations: Record<string, string> = {};
      userLocations.forEach((loc, id) => {
        locations[id] = loc;
      });
      socket.emit("all_locations", locations);
    });

    socket.on("user_location", (location) => {
      const userId = onlineUsers.get(socket.id);
      if (userId) {
        userLocations.set(userId, location);
        io.emit("user_location", { userId, location });
      }
    });

    socket.on("get_online_users", (callback) => {
      if (typeof callback === "function") {
        const onlineUserIds = Array.from(userSockets.keys());
        callback(onlineUserIds);
      }
    });

    socket.on("global_message", (data) => {
      // Broadcast to all clients
      io.emit("global_message", {
        ...data,
        timestamp: new Date().toISOString()
      });
    });

    socket.on("player_action", (data) => {
      // Broadcast player actions (e.g., leveling up)
      socket.broadcast.emit("player_action", data);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      const userId = onlineUsers.get(socket.id);
      if (userId) {
        onlineUsers.delete(socket.id);
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
            io.emit("user_status", { userId, status: "offline" });
          }
        }
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
