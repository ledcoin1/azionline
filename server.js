const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Күтіп тұрған ойыншы
let waitingPlayer = null;

// Ағымдағы ойын
let currentGame = {};

io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

  // ===== ОЙЫНҒА ҚОСЫЛУ =====
  socket.on("joinGame", ({ userId }) => {
    if (!waitingPlayer) {
      waitingPlayer = { socket, userId };
      socket.emit("message", "Сіз бірінші ойыншысыз, қарсылас күтілуде...");
    } else {
      const first = waitingPlayer;
      waitingPlayer = null;

      // Хабар
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

      // ОЙЫНДЫ САҚТАУ (рольдермен)
      currentGame = {
        [first.socket.id]: {
          userId: first.userId,
          bet: null,
          role: "starter"
        },
        [socket.id]: {
          userId,
          bet: null,
          role: "responder"
        }
      };
    }
  });

  // ===== 1-ОЙЫНШЫ СТАВКА =====
  socket.on("playerBet", ({ bet }) => {
    const player = currentGame[socket.id];
    if (!player || player.role !== "starter") return;

    player.bet = bet;

    // 2-ойыншыға *2 жіберу
    for (let id in currentGame) {
      if (id !== socket.id) {
        io.to(id).emit("opponentBet", { bet: bet * 2 });
      }
    }
  });

  // ===== 2-ОЙЫНШЫ ГОТОВ / ОТБОЙ =====
  socket.on("playerReady", ({ ready }) => {
    const player = currentGame[socket.id];
    if (!player || player.role !== "responder") return;

    for (let id in currentGame) {
      if (id !== socket.id) {
        io.to(id).emit("opponentReady", { ready });
      }
    }
  });

  // ===== DISCONNECT =====
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
