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
const lobby = {};       // lobby-де күтіп тұрғандар
const rooms = {};       // room-дар
let roomCounter = 1;
const ROOM_MAX = 5;     // максималды ойыншы саны room-да

// ================== SOCKET.IO ==================
io.on("connection", (socket) => {
  console.log("🔌 Қосылды:", socket.id);

  // Telegram user кіргенде
  socket.on("telegram_user", (user) => {
    lobby[socket.id] = {
      socketId: socket.id,
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      status: "lobby"
    };

    console.log("🟢 Lobby:", Object.keys(lobby).length);

    socket.emit("login_success", lobby[socket.id]);

    broadcastLobby();
  });

  // “Играть” батырмасы басылғанда
  socket.on("join_room", () => {
    assignToRoom(socket);
  });

  // disconnect
  socket.on("disconnect", () => {
    console.log("❌ Шықты:", socket.id);

    // Lobby-ден өшіру
    delete lobby[socket.id];

    // Room-дан өшіру
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

    broadcastLobby();
  });

  // ================== FUNCTIONS ==================

  // Lobby live жаңарту
  function broadcastLobby() {
    io.emit("lobby_update", Object.values(lobby));
  }

  // Room-ға қосу / жасау
  function assignToRoom(socket) {
    const player = lobby[socket.id];
    if (!player) return; // lobby-де жоқ болса

    // 1️⃣ Бар room табу
    let targetRoomId = null;
    for (const rId in rooms) {
      if (rooms[rId].players.length < ROOM_MAX) {
        targetRoomId = rId;
        break;
      }
    }

    if (targetRoomId) {
      // 2️⃣ Бар room-ға қосу
      rooms[targetRoomId].players.push(player);
      delete lobby[socket.id];
      socket.join(targetRoomId);

      console.log(`👤 ${player.first_name} қосылды: ${targetRoomId}`);

      // Room жаңарту
      io.to(targetRoomId).emit("room_joined", {
        roomId: targetRoomId,
        players: rooms[targetRoomId].players
      });

      broadcastLobby(); // lobby жаңарту
    } else {
      // 3️⃣ Жаңа room жасау (кем дегенде 2 адам болса)
      const lobbyIds = Object.keys(lobby);
      if (lobbyIds.length >= 2) {
        const p1 = lobby[lobbyIds[0]];
        const p2 = lobby[lobbyIds[1]];

        const roomId = "room-" + roomCounter++;
        rooms[roomId] = {
          id: roomId,
          players: [p1, p2]
        };

        // Lobby-ден өшіру
        delete lobby[p1.socketId];
        delete lobby[p2.socketId];

        // Socket.IO room-ға қосу
        io.sockets.sockets.get(p1.socketId)?.join(roomId);
        io.sockets.sockets.get(p2.socketId)?.join(roomId);

        console.log(`🏠 Жаңа room жасалды: ${roomId}`);

        io.to(roomId).emit("room_joined", {
          roomId,
          players: rooms[roomId].players
        });

        broadcastLobby();

        // Егер бұл socket 3-ші адам болса → рекурсив қосу
        if (socket.id !== p1.socketId && socket.id !== p2.socketId) {
          assignToRoom(socket);
        }
      }
    }
  }
});

// ================== START SERVER ==================
const PORT = 3000;
server.listen(PORT, () => {
  console.log("🚀 Сервер іске қосылды: http://localhost:3000");
});
