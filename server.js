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
    players: [],          // {id, name, balance}
    status: "waiting",
    phase: "waiting",
    turnIndex: null,
    currentNumber: null
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

    // Бастапқы баланс 1000
    room.players.push({ id: socket.id, name: playerName, balance: 1000 });
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

  // 1-ші ойыншыдан сан таңдау
  socket.on("player_choice", (data) => {
    const room = findRoomBySocket(socket);
    if (!room) return;

    room.currentNumber = data.number;
    const doubledNumber = room.currentNumber * 2;

    io.to(room.id).emit("log_update", {
      msg: `${socket.id} таңдаған сан: ${room.currentNumber}, 2 есе көбейтілді: ${doubledNumber}`
    });

    // 2-ші ойыншыға батырма жіберу
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    const nextPlayer = room.players[room.turnIndex];

    io.to(nextPlayer.id).emit("your_turn_button", { number: doubledNumber, balance: nextPlayer.balance });
  });

  // 2-ші және 3-ші ойыншылар келіссе немесе отбой жасаса
  socket.on("player_confirm", (data) => {
    const room = findRoomBySocket(socket);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    const chosenNumber = room.currentNumber;

    if (data.choice === "Келісемін") {
      if (player.balance >= chosenNumber) {
        player.balance -= chosenNumber;
        io.to(socket.id).emit("log_update", { msg: `💰 ${chosenNumber} балансынан алынды. Қалған: ${player.balance}` });
      } else {
        io.to(socket.id).emit("log_update", { msg: `⚠️ Баланс жеткіліксіз!` });
      }
    } else {
      io.to(room.id).emit("log_update", { msg: `${player.name} Отбой жасады` });
    }

    // Барлық ойыншыларға баланс жаңарту
    io.to(room.id).emit("balance_update", {
      players: room.players.map(p => ({ name: p.name, balance: p.balance }))
    });

    // Келесі ойыншыға кезек беру
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    const nextPlayer = room.players[room.turnIndex];

    if (nextPlayer.id === room.players[0].id) {
      io.to(nextPlayer.id).emit("your_turn", { message: "50–150 арасында сан таңда!" });
    } else {
      io.to(nextPlayer.id).emit("your_turn_button", { number: chosenNumber, balance: nextPlayer.balance });
    }
  });

  // Disconnect
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
