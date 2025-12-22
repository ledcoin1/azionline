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

      // Game экран ашу
      first.socket.emit("opponentFound", { opponentId: userId });
      socket.emit("opponentFound", { opponentId: first.userId });

      // Ойын логикасын сақтау
      currentGame = {
        [first.socket.id]: { userId: first.userId, bet: null },
        [socket.id]: { userId, bet: null }
      };
    }
  });

  // Бірінші ойыншы ставка жіберсе
  socket.on("playerBet", ({ bet }) => {
    console.log("Ставка:", bet);

    if (!currentGame[socket.id]) return;

    currentGame[socket.id].bet = bet;

    // Қарсыласқа жіберу
    for (let id in currentGame) {
      if (id !== socket.id) {
        io.to(id).emit("opponentBet", { bet: bet * 2 });
      }
    }
  });

  // Екінші ойыншы готов / отбой
  socket.on("playerReady", ({ ready }) => {
    console.log("Ready:", ready);

    for (let id in currentGame) {
      if (id !== socket.id) {
        io.to(id).emit("opponentReady", { ready });
      }
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("Клиент шықты:", socket.id);

    delete currentGame[socket.id];

    if (waitingPlayer && waitingPlayer.socket.id === socket.id) {
      waitingPlayer = null;
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
