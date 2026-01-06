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
const ROOM_MAX = 5; // максималды ойыншы саны room-да

// ================== SOCKET.IO ==================
io.on("connection", (socket) => {
  console.log("🔌 Қосылды:", socket.id);

  socket.on("telegram_user", (user) => {
    // Lobby-ге қосу
    lobby[socket.id] = {
      socketId: socket.id,
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      status: "lobby",
    };

    console.log("🟢 Lobby:", Object.keys(lobby).length);

    socket.emit("login_success", lobby[socket.id]);

    // Room жасау / қосу
    assignToRoom(socket);
  });

  socket.on("disconnect", () => {
    console.log("❌ Шықты:", socket.id);
    delete lobby[socket.id];

    // room ішінен шығару
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const index = room.players.findIndex(p => p.socketId === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        // room бос болса → өшіру
        if (room.players.length === 0) delete rooms[roomId];
        else io.to(roomId).emit("room_joined", { roomId, players: room.players });
      }
    }
  });

  // ================== FUNCTIONS ==================

  function assignToRoom(socket) {
    const lobbyIds = Object.keys(lobby);

    // 1️⃣ Ең соңғы ашылған room-ды табамыз
    let targetRoomId = null;
    for (const rId in rooms) {
      if (rooms[rId].players.length < ROOM_MAX) {
        targetRoomId = rId;
      }
    }

    const player = lobby[socket.id];

    if (targetRoomId) {
      // 2️⃣ Бар room-ға қосу
      rooms[targetRoomId].players.push(player);
      delete lobby[socket.id];

      io.sockets.sockets.get(socket.id)?.join(targetRoomId);
      console.log(`👤 ${player.first_name} қосылды: ${targetRoomId}`);

      io.to(targetRoomId).emit("room_joined", {
        roomId: targetRoomId,
        players: rooms[targetRoomId].players
      });

    } else if (lobbyIds.length >= 2) {
      // 3️⃣ Жаңа room жасау
      const roomId = "room-" + roomCounter++;
      const p1 = lobby[lobbyIds[0]];
      const p2 = lobby[lobbyIds[1]];

      rooms[roomId] = {
        id: roomId,
        players: [p1, p2]
      };

      // Lobby-ден өшіру
      delete lobby[p1.socketId];
      delete lobby[p2.socketId];

      io.sockets.sockets.get(p1.socketId)?.join(roomId);
      io.sockets.sockets.get(p2.socketId)?.join(roomId);

      console.log("🏠 Жаңа room жасалды:", roomId);

      // Room-ға хабарлау
      io.to(roomId).emit("room_joined", {
        roomId,
        players: rooms[roomId].players
      });

      // 3-ші адамға шақыру
      if (socket.id !== p1.socketId && socket.id !== p2.socketId) {
        assignToRoom(socket);
      }
    }
  }
});

// ================== START SERVER ==================
const PORT = 3000;
server.listen(PORT, () => {
  console.log("🚀 Сервер іске қосылды: http://localhost:3000");
});
