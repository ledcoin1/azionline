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
 * Сокет арқылы кімнің қай комнатада екенін табу
 */
function findRoomBySocket(socket) {
  return Object.values(rooms).find(room =>
    room.players.some(p => p.id === socket.id)
  );
}


 io.on("connection", (socket) => {
  console.log("🔵 Клиент қосылды:", socket.id);

  // Клиент қосылған кезде сигналдар
  socket.on("join", (playerName) => {
    console.log("➡️ JOIN:", playerName);

    let room = Object.values(rooms).find(
      r => r.status === "waiting" && r.players.length < 3
    );

    if (!room) {
      const roomId = createRoom();
      room = rooms[roomId];
    }

    room.players.push({ id: socket.id, name: playerName });
    socket.join(room.id);

    console.log(`👤 ${playerName} → ${room.id} (${room.players.length}/3)`);

    io.to(room.id).emit("room_update", {
      roomId: room.id,
      players: room.players,
      status: room.status
    });

  

    // 3 ойыншы болса — ойын басталды
    if (room.players.length === 3) {
      room.status = "started";
      room.phase = "playing";
      room.turnIndex = 0;

      console.log("🔥 ОЙЫН БАСТАЛДЫ:", room.id);

      io.to(room.id).emit("game_started", {
        roomId: room.id,
        players: room.players
      });

      // Бірінші ойыншыға сұрақ
      const firstPlayer = room.players[room.turnIndex];
      io.to(firstPlayer.id).emit("your_turn", { message: "50–150 арасында сан таңда!" });
    }
  });

  // 1-ші ойыншыдан жауап қабылдау (осы жерде, join ішінде емес)
  socket.on("player_choice", (data) => {
  const room = findRoomBySocket(socket); // функция арқылы кімнің кім екенін табу
  if (!room) return;

  const chosenNumber = data.number;
  console.log(`🎯 ${socket.id} таңдауы: ${chosenNumber}`);

  // санды 2 есе көбейту
  const doubledNumber = chosenNumber * 2;

  // turnIndex жаңарту — келесі ойыншыға беру
  room.turnIndex = (room.turnIndex + 1) % room.players.length;
  const nextPlayer = room.players[room.turnIndex];

  io.to(nextPlayer.id).emit("your_turn", {
    message: `Сенің кезегің! Алдыңғы сан 2 есе көбейтілді: ${doubledNumber}`
  });

  // Барлығына лог ретінде көрсету (қалауы бойынша)
  io.to(room.id).emit("log_update", {
    msg: `${socket.id} таңдаған сан: ${chosenNumber}, 2 есе көбейтілді: ${doubledNumber}`
  });
});


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
server.listen(PORT, () => {
  console.log("🚀 Server ONLINE on port", PORT);
});
