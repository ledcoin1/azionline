const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let waitingPlayer = null;
let currentGame = {}; // екі ойыншының деректерін сақтау

io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

  socket.on("joinGame", ({ userId }) => {
    console.log("Ойынға қосылды:", userId);

    if (!waitingPlayer) {
      // Бірінші ойыншы күтілуде
      waitingPlayer = { socket, userId };
      socket.emit("message", "Сіз бірінші ойыншы, қарсылас күтілуде...");
    } else {
      // Екінші ойыншы қосылды
      const first = waitingPlayer;
      waitingPlayer = null;

      first.socket.emit("message", `Қарсылас табылды! Екінші ойыншы: ${userId}`);
      socket.emit("message", `Қарсылас табылды! Бірінші ойыншы: ${first.userId}`);

      // Game экран сигнал
      first.socket.emit("opponentFound", { opponentId: userId });
      socket.emit("opponentFound", { opponentId: first.userId });

      // Логика сақтау
      currentGame = {
        [first.socket.id]: { userId: first.userId, bet: null },
        [socket.id]: { userId, bet: null }
      };
    }
  });

  // 1-ойыншы ставка жіберсе
  socket.on("playerBet", ({ bet }) => {
    if (!currentGame[socket.id]) return;
    currentGame[socket.id].bet = bet;

    // Қарсыласқа ставка ×2 хабарлау
    for (let id in currentGame) {
      if (id !== socket.id) {
        io.to(id).emit("opponentBet", { bet: bet * 2 });
      }
    }
  });

  // 2-ойыншы готов/отбой
  socket.on("responderDecision", ({ decision }) => {
    const opponentId = Object.keys(currentGame).find(id => id !== socket.id);
    if (!opponentId) return;

    if (decision === "готов") {
      // 3 карта тарату
      const suits = ["♠", "♥", "♣", "♦"];
      const values = ["6","7","8","9","10","J","Q","K","A"];
      const getRandomCard = () => ({ suit: suits[Math.floor(Math.random()*4)], value: values[Math.floor(Math.random()*9)] });

      // 1-ойыншы карталары
      const player1Cards = [getRandomCard(), getRandomCard(), getRandomCard()];
      // 2-ойыншы карталары
      const player2Cards = [getRandomCard(), getRandomCard(), getRandomCard()];
      // Көзір
      const trump = getRandomCard();

      // Екі ойыншыға жіберу
      io.to(socket.id).emit("dealCards", { playerCards: player2Cards, opponentCardsCount: 3, trump });
      io.to(opponentId).emit("dealCards", { playerCards: player1Cards, opponentCardsCount: 3, trump });
    } else {
      // Отбой болса ойын тоқтайды
      io.to(socket.id).emit("gameCanceled", { message: "Ойын тоқтатылды" });
      io.to(opponentId).emit("gameCanceled", { message: "Ойын тоқтатылды" });
      delete currentGame[socket.id];
      delete currentGame[opponentId];
    }
  });

  socket.on("disconnect", () => {
    console.log("Клиент шықты:", socket.id);
    delete currentGame[socket.id];
    if (waitingPlayer && waitingPlayer.socket.id === socket.id) waitingPlayer = null;
  });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
