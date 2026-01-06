// ================== IMPORTS ==================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// ================== APP / SERVER ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// ================== STORAGE ==================
const lobby = {};
const rooms = {};
let roomCounter = 1;

// ================== SOCKET.IO ==================
io.on("connection", (socket) => {
  console.log("🔌 Қосылды:", socket.id);

  socket.on("telegram_user", (user) => {
    // 1️⃣ Lobby-ге қосу
    lobby[socket.id] = {
      socketId: socket.id,
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      status: "lobby",
    };

    console.log("🟢 Lobby:", Object.keys(lobby).length);

    socket.emit("login_success", lobby[socket.id]);

    // 2️⃣ Lobby-де 2 адам болса → room жасау
    tryCreateRoom();
  });

  socket.on("disconnect", () => {
    console.log("❌ Шықты:", socket.id);
    delete lobby[socket.id];
  });

  // ================== FUNCTIONS ==================

  function tryCreateRoom() {
    const lobbyIds = Object.keys(lobby);

    if (lobbyIds.length < 2) return;

    // 3️⃣ Алғашқы 2 адамды аламыз
    const p1 = lobby[lobbyIds[0]];
    const p2 = lobby[lobbyIds[1]];

    const roomId = "room-" + roomCounter++;

    // 4️⃣ Room жасау
    rooms[roomId] = {
      id: roomId,
      players: [p1, p2],
    };

    // 5️⃣ Lobby-ден өшіру
    delete lobby[p1.socketId];
    delete lobby[p2.socketId];

    // 6️⃣ Socket.IO room-ға қосу
    io.sockets.sockets.get(p1.socketId)?.join(roomId);
    io.sockets.sockets.get(p2.socketId)?.join(roomId);

    console.log("🏠 Room жасалды:", roomId);

    // 7️⃣ Екі ойыншыға хабарлау
    io.to(roomId).emit("room_joined", {
      roomId,
      players: rooms[roomId].players,
    });
  }
});

// ================== START SERVER ==================
server.listen(3000, () => {
  console.log("🚀 Сервер іске қосылды: http://localhost:3000");
});
