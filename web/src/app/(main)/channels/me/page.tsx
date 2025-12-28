const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Store online users
// userId -> { userId, username }
const onlineUsers = new Map();

// Store DM relationships
// "userA-userB" (sorted)
const dmPairs = new Set();

function dmKey(a: string, b: string) {
  return [a, b].sort().join("-");
}

io.on("connection", (socket: any) => {
  console.log("User connected:", socket.id);

  socket.on("login", ({ userId, username }: { userId: string; username: string }) => {
    socket.userId = userId;

    // Save user
    onlineUsers.set(userId, { userId, username });

    const dmList = [];

    // Auto-create DMs with everyone else
    for (const [otherId, otherUser] of onlineUsers.entries()) {
      if (otherId === userId) continue;

      const key = dmKey(userId, otherId);
      if (!dmPairs.has(key)) {
        dmPairs.add(key);
      }

      dmList.push(otherUser);

      // Notify other user
      io.to([...io.sockets.sockets.values()]
        .find(s => s.userId === otherId)?.id || ""
      ).emit("dm:add", { userId, username });
    }

    // Send full DM list to current user
    socket.emit("dm:init", dmList);
  });

  socket.on("disconnect", () => {
    if (!socket.userId) return;
    onlineUsers.delete(socket.userId);
    console.log("User disconnected:", socket.userId);
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
