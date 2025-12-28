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
    thirdPlayerBet: 0,
    secondPlayerAccepted: false,
    secondPlayerFolded: false,
    thirdPlayerAccepted: false,
    thirdPlayerFolded: false,
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

    if (room.players.length === 3) {
      room.status = "started";
      room.turnIndex = 0;

      io.to(room.id).emit("game_started", { roomId: room.id, players: room.players });

      // Бірінші ойыншыға сигнал
      const firstPlayer = room.players[0];
      io.to(firstPlayer.id).emit("your_turn", { message: "Сіздің кезегіңіз! 50–150 арасында сан таңдаңыз." });
    }
  });

  // --- 1-ойыншыдан ставка ---
  socket.on("first_player_bet", (data) => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    if (room.players[0].id !== socket.id) return;

    let bet = data.bet;
    if (bet < 50 || bet > 150) return;

    // Баланстан азайту
    const player1 = room.players[0];
    if (player1.balance < bet) return;
    player1.balance -= bet;

    // 2 есе көбейту
    room.firstBet = bet * 2;

    // 2-ойыншыға жіберу
    const secondPlayer = room.players[1];
    io.to(secondPlayer.id).emit("first_player_bet_doubled", { bet: room.firstBet });
  });

  // --- 2-ойыншыдан келісемін ---
  socket.on("second_player_accept", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    if (room.players[1].id !== socket.id) return;

    const player2 = room.players[1];
    const bet = room.firstBet;

    // Баланс тексеру
    if (player2.balance < bet) return;
    player2.balance -= bet;

    room.secondPlayerAccepted = true;
    room.secondPlayerBet = bet * 2;

    // 3-ойыншыға жіберу
    const thirdPlayer = room.players[2];
    io.to(thirdPlayer.id).emit("second_player_bet_doubled_again", { bet: room.secondPlayerBet });
  });

  // --- 2-ойыншыдан отбой ---
  socket.on("second_player_fold", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    if (room.players[1].id !== socket.id) return;

    room.secondPlayerFolded = true;

    // 3-ойыншыға жіберу (1-ойыншының ставкасы *2)
    const thirdPlayer = room.players[2];
    io.to(thirdPlayer.id).emit("second_player_folded_bet", { bet: room.firstBet });
  });

  // --- 3-ойыншыдан келісемін ---
  socket.on("third_player_accept", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    if (room.players[2].id !== socket.id) return;

    const player3 = room.players[2];
    let bet = room.secondPlayerFolded ? room.firstBet : room.secondPlayerBet;

    if (player3.balance < bet) return;
    player3.balance -= bet;

    room.thirdPlayerAccepted = true;
    room.thirdPlayerBet = bet;

    // Финалдық шешім
    const p1 = room.players[0];
    const p2 = room.secondPlayerFolded ? null : room.players[1];
    const p3 = room.players[2];

    const winners = [p1];
    if (p2) winners.push(p2);
    winners.push(p3);

    // 3 ойыншы да келіскен жағдайда
    io.to(room.id).emit("game_result", { winners: winners.map(p => p.name) });
  });

  // --- 3-ойыншыдан отбой ---
  socket.on("third_player_fold", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    if (room.players[2].id !== socket.id) return;

    room.thirdPlayerFolded = true;

    const p1 = room.players[0];
    const p2 = room.secondPlayerFolded ? null : room.players[1];

    const winners = [p1];
    if (p2) winners.push(p2);

    if (winners.length === 0) {
      io.to(room.id).emit("game_result", { winners: [], message: "Ешкім келіспеді" });
    } else {
      io.to(room.id).emit("game_result", { winners: winners.map(p => p.name) });
    }
  });

}); // connection end

// --- Серверді іске қосу ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server ONLINE on port", PORT));
