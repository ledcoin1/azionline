const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

// Комната жасау
function createRoom() {
  const roomId = "room-" + Date.now();
  rooms[roomId] = {
    id: roomId,
    players: [],  // {id, name, balance}
    status: "waiting",
    turnIndex: null,
    firstBet: 0,
    secondPlayerBet: 0,
    thirdPlayerBet: 0,
    secondPlayerAccepted: false,
    secondPlayerFolded: false,
    thirdPlayerAccepted: false,
    thirdPlayerFolded: false
  };
  return rooms[roomId];
}

// Кімнің кім екенін табу
function findRoomBySocket(socket) {
  return Object.values(rooms).find(room =>
    room.players.some(p => p.id === socket.id)
  );
}

// --- Socket.IO connection ---
io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

  // JOIN сигнал
  socket.on("join", (playerName) => {
    let room = Object.values(rooms).find(r => r.status === "waiting" && r.players.length < 3);
    if (!room) room = createRoom();

    room.players.push({ id: socket.id, name: playerName, balance: 1000 });
    socket.join(room.id);

    io.to(room.id).emit("room_update", { players: room.players, status: room.status });

    // 3 ойыншы қосылғанда ойын басталады
    if (room.players.length === 3) {
      room.status = "started";
      room.turnIndex = 0;

      io.to(room.id).emit("game_started", { roomId: room.id, players: room.players });

      // Бірінші ойыншыға сигнал
      const firstPlayer = room.players[room.turnIndex];
      io.to(firstPlayer.id).emit("your_turn", { message: "Сіздің кезегіңіз! 50–150 арасында сан таңдаңыз." });
    }
  });

  // --- 1-ойыншыдан ставка ---
  socket.on("first_player_bet", (data) => {
    const room = findRoomBySocket(socket);
    if (!room) return;

    // CHANGED: тек ағымдағы ойыншының кезегін тексеру
    if (room.turnIndex !== 0 || room.players[0].id !== socket.id) return;

    let bet = data.bet;
    if (bet < 50 || bet > 150) return;

    bet *= 2;
    room.firstBet = bet;

    const secondPlayer = room.players[1];
    io.to(secondPlayer.id).emit("first_player_bet_doubled", { bet });

    // CHANGED: кезек жаңарту
    room.turnIndex = 1;
    io.to(room.players[room.turnIndex].id).emit("your_turn", { message: "Сіздің кезегіңіз!" });
  });

  // --- 2-ойыншы келіссе ---
  socket.on("second_player_accept", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;

    // CHANGED: тек ағымдағы ойыншының кезегін тексеру
    if (room.turnIndex !== 1 || room.players[1].id !== socket.id) return;

    room.secondPlayerAccepted = true;
    room.secondPlayerBet = room.firstBet * 2;

    const thirdPlayer = room.players[2];
    io.to(thirdPlayer.id).emit("second_player_bet_doubled_again", { bet: room.secondPlayerBet });

    // CHANGED: кезек жаңарту
    room.turnIndex = 2;
    io.to(room.players[room.turnIndex].id).emit("your_turn", { message: "Сіздің кезегіңіз!" });
  });

  // --- 2-ойыншы отбой ---
  socket.on("second_player_fold", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;

    // CHANGED: тек ағымдағы ойыншының кезегін тексеру
    if (room.turnIndex !== 1 || room.players[1].id !== socket.id) return;

    room.secondPlayerFolded = true;
    const bet = room.firstBet * 2;

    const thirdPlayer = room.players[2];
    io.to(thirdPlayer.id).emit("second_player_folded_bet", { bet });

    // CHANGED: кезек жаңарту
    room.turnIndex = 2;
    io.to(room.players[room.turnIndex].id).emit("your_turn", { message: "Сіздің кезегіңіз!" });
  });

  // --- 3-ойыншы келіссе ---
  socket.on("third_player_accept", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;

    // CHANGED: тек ағымдағы ойыншының кезегін тексеру
    if (room.turnIndex !== 2 || room.players[2].id !== socket.id) return;

    room.thirdPlayerAccepted = true;
    room.thirdPlayerBet = room.secondPlayerBet;

    // CHANGED: барлық ойыншыларға хабарлау немесе келесі логика
    io.to(room.id).emit("round_finished", { finalBet: room.thirdPlayerBet });
  });

  // --- 3-ойыншы отбой ---
  socket.on("third_player_fold", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;

    // CHANGED: тек ағымдағы ойыншының кезегін тексеру
    if (room.turnIndex !== 2 || room.players[2].id !== socket.id) return;

    room.thirdPlayerFolded = true;

    // CHANGED: барлық ойыншыларға хабарлау немесе келесі логика
    io.to(room.id).emit("round_finished", { finalBet: room.secondPlayerBet });
  });
});

// --- Серверді іске қосу ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server ONLINE on port", PORT));
