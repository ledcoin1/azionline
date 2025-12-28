const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/**
 * Барлық комнаталар
 */
const rooms = {};

/**
 * Комната жасау
 */
function createRoom() {
  const roomId = "room-" + Date.now();

  rooms[roomId] = {
    id: roomId,
    players: [],
    status: "waiting",
    phase: "waiting",
    turnIndex: null
  };

  console.log("🟢 Комната ашылды:", roomId);
  return roomId;
}


/**
 * Клиент қосылды
 */
io.on("connection", (socket) => {
  console.log("🔵 Клиент қосылды:", socket.id);

  /**
   * JOIN
   */
  socket.on("join", (playerName) => {
    console.log("➡️ JOIN:", playerName);

    // Ашық комната іздеу
    let room = Object.values(rooms).find(
      r => r.status === "waiting" && r.players.length < 3
    );

    // Егер жоқ болса — жаңасын жасау
    if (!room) {
      const roomId = createRoom();
      room = rooms[roomId];
    }

    // Ойыншыны қосу
    room.players.push({
      id: socket.id,
      name: playerName
    });

    socket.join(room.id);

    console.log(
      `👤 ${playerName} → ${room.id} (${room.players.length}/3)`
    );

    // Комната обновление
    io.to(room.id).emit("room_update", {
      roomId: room.id,
      players: room.players,
      status: room.status
    });

    // ✅ 3 ойыншы болса — ойын басталды
    if (room.players.length === 3) {
      room.status = "started";
        room.phase = "playing";      // қосу керек
        room.turnIndex = 0;

      console.log("🔥 ОЙЫН БАСТАЛДЫ:", room.id);

      io.to(room.id).emit("game_started", {
        roomId: room.id,
        players: room.players
      });
       
   const firstPlayer = room.players[room.turnIndex];
  const randomNumber = Math.floor(Math.random() * 101) + 50; // 50–150
  io.to(firstPlayer.id).emit("your_turn", { number: randomNumber });
}
    }
  );

  /**
   * Disconnect
   */
  socket.on("disconnect", () => {
    console.log("❌ Клиент шықты:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];

      room.players = room.players.filter(
        p => p.id !== socket.id
      );

      if (room.players.length === 0) {
        delete rooms[roomId];
        console.log("🗑 Комната өшірілді:", roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Server ONLINE on port", PORT);
});
