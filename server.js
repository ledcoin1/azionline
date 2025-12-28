const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

function createRoom() {
  const roomId = "room-" + Date.now();
  rooms[roomId] = {
    id: roomId,
    players: [],
    status: "waiting",
    phase: "waiting",
    turnIndex: null,
    currentNumber: null
  };
  console.log("🟢 Комната ашылды:", roomId);
  return roomId;
}

function findRoomBySocket(socket) {
  return Object.values(rooms).find(room =>
    room.players.some(p => p.id === socket.id)
  );
}

io.on("connection", (socket) => {
  console.log("🔵 Клиент қосылды:", socket.id);

  socket.on("join", (playerName) => {
    let room = Object.values(rooms).find(r => r.status === "waiting" && r.players.length < 3);

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

    if (room.players.length === 3) {
      room.status = "started";
      room.phase = "playing";
      room.turnIndex = 0;

      io.to(room.id).emit("game_started", { roomId: room.id, players: room.players });

      // Бірінші ойыншыдан сан сұрау
      const firstPlayer = room.players[room.turnIndex];
      io.to(firstPlayer.id).emit("your_turn", { message: "Сен бірінші ойыншысың, 50–150 арасында сан таңда!" });
    }
  });

  // 1-ші ойыншыдан сан алу
  socket.on("player_choice", (data) => {
    const room = findRoomBySocket(socket);
    if (!room) return;

    room.currentNumber = data.number;
    const doubledNumber = room.currentNumber * 2;

    io.to(room.id).emit("log_update", {
      msg: `${socket.id} таңдаған сан: ${room.currentNumber}, 2 есе көбейтілді: ${doubledNumber}`
    });

    // Келесі ойыншыға тек батырма жіберу
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    const nextPlayer = room.players[room.turnIndex];

    io.to(nextPlayer.id).emit("your_turn_button", { number: doubledNumber });
  });

  // 2-ші және 3-ші ойыншылардан келісу/отбой қабылдау
  socket.on("player_confirm", (data) => {
    const room = findRoomBySocket(socket);
    if (!room) return;

    io.to(room.id).emit("log_update", { msg: `${socket.id} таңдауы: ${data.choice}` });

    // Келесі ойыншыға кезек беру
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    const nextPlayer = room.players[room.turnIndex];

    if (nextPlayer.id === room.players[0].id) {
      // Бірінші ойыншыға қайта сан таңдау
      io.to(nextPlayer.id).emit("your_turn", { message: "50–150 арасында сан таңда!" });
    } else {
      io.to(nextPlayer.id).emit("your_turn_button", { number: room.currentNumber });
    }
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
server.listen(PORT, () => console.log("🚀 Server ONLINE on port", PORT));
