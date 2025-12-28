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
    players: [], // {id, name, balance}
    status: "waiting",
    turnIndex: null,
    firstBet: 0,
    secondPlayerAccepted: false,
    secondPlayerFolded: false,
    secondPlayerBet: 0,
    thirdPlayerAccepted: false,
    thirdPlayerFolded: false,
    thirdPlayerBet: 0
  };
  return rooms[roomId];
}

function findRoomBySocket(socket) {
  return Object.values(rooms).find(room =>
    room.players.some(p => p.id === socket.id)
  );
}

io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

  // JOIN сигнал
  socket.on("join", (playerName) => {
    let room = Object.values(rooms).find(r => r.status === "waiting" && r.players.length < 3);
    if (!room) room = createRoom();

    room.players.push({ id: socket.id, name: playerName, balance: 1000 });
    socket.join(room.id);

    io.to(room.id).emit("room_update", { players: room.players, status: room.status });

    if (room.players.length === 3) {
      room.status = "started";
      room.turnIndex = 0;

      io.to(room.id).emit("game_started", { roomId: room.id, players: room.players });

      // 1-ойыншыға сигнал
      const firstPlayer = room.players[0];
      io.to(firstPlayer.id).emit("your_turn", { message: "Сіздің кезегіңіз! 50–150 арасында сан таңдаңыз." });
    }
  });

  // 1-ойыншы ставкасы
  socket.on("first_player_bet", (data) => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    if (room.turnIndex !== 0 || room.players[0].id !== socket.id) return;

    let bet = Number(data.bet);
    if (bet < 50 || bet > 150) return;

    // Баланстан азайту
    const player = room.players[0];
    if (player.balance < bet) return; // жеткіліксіз баланс
    player.balance -= bet;

    // 2 есе көбейту
    room.firstBet = bet * 2;

    // 2-ойыншыға жіберу
    const secondPlayer = room.players[1];
    io.to(secondPlayer.id).emit("first_player_bet_doubled", { bet: room.firstBet });

    // Кезек жаңарту
    room.turnIndex = 1;
    io.to(secondPlayer.id).emit("your_turn", { message: "Сіздің кезегіңіз! Accept немесе Fold таңдаңыз." });
  });

  // 2-ойыншы accept
  socket.on("second_player_accept", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    if (room.players[1].id !== socket.id) return;

    room.secondPlayerAccepted = true;

    const player2 = room.players[1];
    if (player2.balance < room.firstBet) return; // жеткіліксіз баланс
    player2.balance -= room.firstBet;

    room.secondPlayerBet = room.firstBet * 2;

    // 3-ойыншыға сигнал
    const thirdPlayer = room.players[2];
    io.to(thirdPlayer.id).emit("second_player_bet_doubled_again", { bet: room.secondPlayerBet });

    // Кезек жаңарту
    room.turnIndex = 2;
    io.to(thirdPlayer.id).emit("your_turn", { message: "Сіздің кезегіңіз! Accept немесе Fold таңдаңыз." });
  });

  // 2-ойыншы fold
  socket.on("second_player_fold", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    if (room.players[1].id !== socket.id) return;

    room.secondPlayerFolded = true;

    // 3-ойыншыға ставка бұрынғы күйде
    const thirdPlayer = room.players[2];
    io.to(thirdPlayer.id).emit("second_player_folded_bet", { bet: room.firstBet });

    // Кезек жаңарту
    room.turnIndex = 2;
    io.to(thirdPlayer.id).emit("your_turn", { message: "Сіздің кезегіңіз! Accept немесе Fold таңдаңыз." });
  });

  // 3-ойыншы accept
  socket.on("third_player_accept", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    if (room.players[2].id !== socket.id) return;

    room.thirdPlayerAccepted = true;

    const player3 = room.players[2];
    if (player3.balance < room.secondPlayerBet) return;
    player3.balance -= room.secondPlayerBet;

    room.thirdPlayerBet = room.secondPlayerBet;

    // Барлық қатысушыларға хабар
    io.to(room.id).emit("game_result", { message: "Барлық қатысушылар ойындасындар!" });
  });

  // 3-ойыншы fold
  socket.on("third_player_fold", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    if (room.players[2].id !== socket.id) return;

    room.thirdPlayerFolded = true;

    // Қалған ойыншыларға хабарлау
    const activePlayers = room.players.filter(p => {
      if (p.id === room.players[0].id && room.players[0].balance > 0) return true;
      if (p.id === room.players[1].id && room.secondPlayerAccepted) return true;
      return false;
    });

    if (activePlayers.length > 0) {
      io.to(activePlayers.map(p => p.id)).emit("game_result", { message: "Қалған ойыншылар ойындасындар!" });
    } else {
      io.to(room.players[0].id).emit("game_result", { message: "Ешкім келіспеді." });
    }
  });

}); // connection

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server ONLINE on port", PORT));
