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
    players: [], // {id, name, balance}
    status: "waiting",
    turnIndex: null,
    firstBet: 0,
    secondPlayerBet: 0,
    thirdPlayerBet: 0
  };
  return rooms[roomId];
}

// Кімнің кім екенін табу
function findRoomBySocket(socket) {
  return Object.values(rooms).find(room =>
    room.players.some(p => p.id === socket.id)
  );
}

// --- Логика функциялары ---

// 1 ойыншыдан ставка алу
function processFirstPlayerBet(room, bet) {
  const firstPlayer = room.players[0];
  if (bet < 50 || bet > 150 || firstPlayer.balance < bet) return false;

  firstPlayer.balance -= bet;
  room.firstBet = bet * 2; // 2 еселенген ставка
  room.turnIndex = 1; // Екінші ойыншының кезегі

  const secondPlayer = room.players[1];
  io.to(secondPlayer.id).emit("first_player_bet_doubled", { bet: room.firstBet });
  io.to(secondPlayer.id).emit("your_turn", { message: "Сіздің кезегіңіз! Келісемін немесе Отбой" });
  return true;
}

// 2 ойыншы шешім қабылдайды
function processSecondPlayerDecision(room, decision) {
  const secondPlayer = room.players[1];

  if (decision === "accept") {
    secondPlayer.balance -= room.firstBet;
    room.secondPlayerBet = room.firstBet * 2; // тағы 2 еселенген
    room.turnIndex = 2; // Үшінші ойыншы кезегі
    const thirdPlayer = room.players[2];
    io.to(thirdPlayer.id).emit("second_player_bet_doubled_again", { bet: room.secondPlayerBet });
    io.to(thirdPlayer.id).emit("your_turn", { message: "Сіздің кезегіңіз! Келісемін немесе Отбой" });
  } else if (decision === "fold") {
    room.secondPlayerFolded = true;
    room.secondPlayerBet = 0;
    room.turnIndex = 2;
    const thirdPlayer = room.players[2];
    // Алдыңғы ставка 2 еселеніп жіберіледі
    const bet = room.firstBet;
    io.to(thirdPlayer.id).emit("second_player_folded_bet", { bet });
    io.to(thirdPlayer.id).emit("your_turn", { message: "Сіздің кезегіңіз! Келісемін немесе Отбой" });
  }
}

// 3 ойыншы шешім қабылдайды
function processThirdPlayerDecision(room, decision) {
  const thirdPlayer = room.players[2];

  if (decision === "accept") {
    thirdPlayer.balance -= room.secondPlayerBet || room.firstBet * 2;
    room.thirdPlayerBet = room.secondPlayerBet || room.firstBet * 2;

    // Барлық ойыншыларға хабарлау
    room.players.forEach(p => {
      io.to(p.id).emit("game_result", { message: "Ойындасындар!", finalBets: {
        first: room.firstBet / 2,
        second: room.secondPlayerBet / 2 || 0,
        third: room.thirdPlayerBet / 2
      }});
    });
  } else if (decision === "fold") {
    room.thirdPlayerFolded = true;

    // Қалған ойыншыларға хабарлау
    const remainingPlayers = room.players.filter(p => !p.folded && p.id !== thirdPlayer.id);
    remainingPlayers.forEach(p => {
      io.to(p.id).emit("game_result", { message: "Ешкім келіспеді" });
    });
  }
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

    if (room.players.length === 3) {
      room.status = "started";
      room.turnIndex = 0;
      io.to(room.id).emit("game_started", { roomId: room.id, players: room.players });

      const firstPlayer = room.players[0];
      io.to(firstPlayer.id).emit("your_turn", { message: "Сіздің кезегіңіз! 50–150 арасында сан таңдаңыз." });
    }
  });

  // --- 1-ойыншыдан ставка ---
  socket.on("first_player_bet", (data) => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    processFirstPlayerBet(room, data.bet);
  });

  // --- 2-ойыншы шешімі ---
  socket.on("second_player_decision", (data) => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    processSecondPlayerDecision(room, data.decision);
  });

  // --- 3-ойыншы шешімі ---
  socket.on("third_player_decision", (data) => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    processThirdPlayerDecision(room, data.decision);
  });
});

// --- Серверді іске қосу ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server ONLINE on port", PORT));
