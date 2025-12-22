const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Бірінші ойыншы
let waitingPlayer = null;

// Қазіргі ойын (2 ойыншы)
let currentGame = {};

io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

  socket.on("joinGame", ({ userId }) => {
    console.log("Ойынға қосылды:", userId);

    if (!waitingPlayer) {
      // 1-ойыншы
      waitingPlayer = { socket, userId };
      socket.emit("message", "Сіз бірінші ойыншысыз, қарсылас күтілуде...");
    } else {
      // 2-ойыншы
      const first = waitingPlayer;
      waitingPlayer = null;

      // Хабарлар
      first.socket.emit(
        "message",
        `Қарсылас табылды! Екінші ойыншы: ${userId}`
      );
      socket.emit(
        "message",
        `Қарсылас табылды! Бірінші ойыншы: ${first.userId}`
      );

     // Қарсылас табылды
first.socket.emit("opponentFound", { opponentId: userId });
socket.emit("opponentFound", { opponentId: first.userId });

// Ойын логикасын сақтау (рольдермен)
currentGame = {
  [first.socket.id]: {
    userId: first.userId,
    bet: null,
    role: "starter"     // 1-ойыншы
  },
  [socket.id]: {
    userId,
    bet: null,
    role: "responder"   // 2-ойыншы
  }
};
// ТЕК 1-ОЙЫНШЫ ставка жібере алады
socket.on("playerBet", ({ bet }) => {
  const player = currentGame[socket.id];
  if (!player || player.role !== "starter") return;

  player.bet = bet;

  // 2-ойыншыға *2 есе жіберу
  for (let id in currentGame) {
    if (id !== socket.id) {
      io.to(id).emit("opponentBet", { bet: bet * 2 });
    }
  }
});
// ТЕК 2-ОЙЫНШЫ готов / отбой жібереді
socket.on("playerReady", ({ ready }) => {
  const player = currentGame[socket.id];
  if (!player || player.role !== "responder") return;

  for (let id in currentGame) {
    if (id !== socket.id) {
      io.to(id).emit("opponentReady", { ready });
    }
  }
});
