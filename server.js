const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/**
 * Барлық комнаталар осында сақталады
 * roomId: roomObject
 */
const rooms = {};

/**
 * 🟢 Комната жасау функциясы
 */
function createRoom() {
  const roomId = "room-" + Date.now();

  rooms[roomId] = {
    id: roomId,
    players: [],        // { id, name }
    status: "waiting"   // waiting | started
  };

  console.log("🟢 Жаңа комната ашылды:", roomId);
  return roomId;
}

/**
 * 🔌 Клиент қосылды
 */
io.on("connection", (socket) => {
  console.log("🔵 Клиент қосылды:", socket.id);

  /**
   * ▶️ JOIN сигналы
   */
  socket.on("join", (playerName) => {
    console.log("➡️ JOIN келді:", playerName);

    // 1️⃣ Ашық комната іздеу
    let room = Object.values(rooms).find(
      r => r.status === "waiting" && r.players.length < 3
    );

    // 2️⃣ Егер жоқ болса — жаңасын жасау
    if (!room) {
      const roomId = createRoom();
      room = rooms[roomId];
    }

    // 3️⃣ Ойыншыны комнатаға қосу
    room.players.push({
      id: socket.id,
      name: playerName
    });

    socket.join(room.id);

    console.log(
      `👤 ${playerName} → ${room.id} (${room.players.length}/3)`
    );

    // 4️⃣ Барлығына жаңарту жіберу
    io.to(room.id).emit("room_update", {
      roomId: room.id,
      players: room.players,
      status: room.status
    });

    // 5️⃣ 3 адам болса → ойын басталды
    if (room.players.length === 3) {
      room.status = "started";

      console.log("🔥 ОЙЫН БАСТАЛДЫ:", room.id);

      io.to(room.id).emit("game_started", {
        roomId: room.id,
        players: room.players
      });
    }
  });

  /**
   * ❌ Disconnect
   */
  socket.on("disconnect", () => {
    console.log("❌ Клиент шықты:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];

      room.players = room.players.filter(p => p.id !== socket.id);

      if (room.players.length === 0) {
        delete rooms[roomId];
        console.log("🗑 Комната өшірілді:", roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log("🚀 Server ONLINE on port", PORT)
);
