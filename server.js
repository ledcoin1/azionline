const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Бірінші ойыншыны сақтау
let waitingPlayer = null;

io.on("connection", (socket) => {
  console.log("Клиент қосылды");

  socket.on("joinGame", ({ userId }) => {
    console.log("Ойынға қосылды:", userId);

    if (!waitingPlayer) {
      // Бірінші ойыншы күтілуде
      waitingPlayer = { socket, userId };
      socket.emit("message", "Сіз бірінші ойыншы, қарсылас күтілуде...");
    } else {
  const first = waitingPlayer;
  waitingPlayer = null;

  // Тек хабар
  first.socket.emit("message", `Қарсылас табылды! Екінші ойыншы: ${userId}`);
  socket.emit("message", `Қарсылас табылды! Бірінші ойыншы: ${first.userId}`);

  // 🔴 Жаңа терезе ашу үшін сигнал
  first.socket.emit("opponentFound", { opponentId: userId });
  socket.emit("opponentFound", { opponentId: first.userId });
}

     // Ойын логикасын сақтау (әр ойыншының socket id және ставка)
      currentGame[first.socket.id] = { userId: first.userId, bet: null };
      currentGame[socket.id] = { userId, bet: null };
    }
  });

  // Бірінші ойыншы ставка жібергенде
  socket.on("playerBet", ({ bet }) => {
    console.log(`Ставка жіберілді: ${bet}`);
    if (!currentGame[socket.id]) return;

    currentGame[socket.id].bet = bet;

    // Қарсыласқа хабар жіберу
    for (let id in currentGame) {
      if (id !== socket.id) {
        io.to(id).emit("opponentBet", { bet });
      }
    }
  });

  // Екінші ойыншы готов/отбой деп жауап берсе
  socket.on("playerReady", ({ ready }) => {
    // қарсыласқа хабар беру
    for (let id in currentGame) {
      if (id !== socket.id) {
        io.to(id).emit("opponentReady", { ready });
      }
    }
  });

  // Клиент disconnect болса ойыннан шығару
  socket.on("disconnect", () => {
    console.log("Клиент шықты:", socket.id);
    delete currentGame[socket.id];
    if (waitingPlayer && waitingPlayer.socket.id === socket.id) {
      waitingPlayer = null;
    }
  });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));


