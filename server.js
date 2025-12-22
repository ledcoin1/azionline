const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Deck үшін масттар мен мәндер
const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function shuffleDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const v of VALUES) {
      deck.push({ suit: s, value: v });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Бірінші ойыншыны сақтау
let waitingPlayer = null;

// Қазіргі ойын объектісі
let currentGame = null;

io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

  // Ойынға қосылу
  socket.on("joinGame", ({ userId }) => {
    console.log("Ойынға қосылды:", userId);

    if (!waitingPlayer) {
      waitingPlayer = { socket, userId };
      socket.emit("message", "Сіз бірінші ойыншы, қарсылас күтілуде...");
    } else {
      const first = waitingPlayer;
      waitingPlayer = null;

      // Хабарлар екі ойыншыға
      first.socket.emit("message", `Қарсылас табылды! Екінші ойыншы: ${userId}`);
      socket.emit("message", `Қарсылас табылды! Бірінші ойыншы: ${first.userId}`);

      // Game экран ашу сигнал
      first.socket.emit("opponentFound", { opponentId: userId });
      socket.emit("opponentFound", { opponentId: first.userId });

      // currentGame объектісін сақтау
      currentGame = {
        starter: { socketId: first.socket.id, userId: first.userId, bet: null },
        responder: { socketId: socket.id, userId: userId, bet: null }
      };
    }
  });

  // Бірінші ойыншы ставка жібергенде
  socket.on("playerBet", ({ bet }) => {
    if (!currentGame) return;
    if (socket.id !== currentGame.starter.socketId) return;

    currentGame.starter.bet = bet;
    console.log(`1-ойыншы ставка: ${bet}`);

    // 2-ойыншыға ставка х2 хабарын жіберу
    io.to(currentGame.responder.socketId).emit("opponentBet", { bet: bet * 2 });
  });

  // 2-ойыншы готов немесе отбой басқанда
  socket.on("responderDecision", ({ decision }) => {
    if (!currentGame) return;
    if (socket.id !== currentGame.responder.socketId) return;

    if (decision === "готов") {
      // Deck жасау
      const deck = shuffleDeck();

      // 3 карта әр ойыншыға
      const starterCards = deck.splice(0, 3);
      const responderCards = deck.splice(0, 3);

      // Ортаға көзір
      const trumpCard = deck.pop();

      // Екі ойыншыға хабар беру
      io.to(currentGame.starter.socketId).emit("dealCards", {
        playerCards: starterCards,
        opponentCardsCount: 3,
        trump: trumpCard
      });

      io.to(currentGame.responder.socketId).emit("dealCards", {
        playerCards: responderCards,
        opponentCardsCount: 3,
        trump: trumpCard
      });
    } else if (decision === "отбой") {
      io.to(currentGame.starter.socketId).emit("gameCanceled", { message: "2-ойыншы отбой жасады." });
      io.to(currentGame.responder.socketId).emit("gameCanceled", { message: "Сіз отбой жасадыңыз." });
      currentGame = null;
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("Клиент шықты:", socket.id);
    if (currentGame) {
      if (socket.id === currentGame.starter.socketId || socket.id === currentGame.responder.socketId) {
        io.to(currentGame.starter.socketId).emit("gameCanceled", { message: "Қарсылас шықты." });
        io.to(currentGame.responder.socketId).emit("gameCanceled", { message: "Қарсылас шықты." });
        currentGame = null;
      }
    }
    if (waitingPlayer && waitingPlayer.socket.id === socket.id) {
      waitingPlayer = null;
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
