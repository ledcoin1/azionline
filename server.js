const express = require("express");   // сайт логикасы
const http = require("http");         // сервер
const { Server } = require("socket.io"); // онлайн байланыс

// сервер жасау
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public")); // public/index.html ашылады

// Бірінші ойыншыны сақтау
let waitingPlayer = null;

io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

  socket.on("joinGame", ({ userId }) => {
    console.log("Ойынға қосылды:", userId);

    if (!waitingPlayer) {
      // 1-ойыншы
      waitingPlayer = { socket, userId };
      socket.emit(
        "message",
        "Сіз бірінші ойыншысыз, қарсылас күтілуде..."
      );
    } else {
      // 2-ойыншы
      const first = waitingPlayer;
      waitingPlayer = null;

      // Хабар жіберу
      first.socket.emit(
        "message",
        `Қарсылас табылды! Екінші ойыншы: ${userId}`
      );

      socket.emit(
        "message",
        `Қарсылас табылды! Бірінші ойыншы: ${first.userId}`
      );

      // Game экранға өту сигналы
      first.socket.emit("opponentFound", { opponentId: userId });
      socket.emit("opponentFound", { opponentId: first.userId });
    }
  });

  socket.on("disconnect", () => {
    console.log("Клиент шықты:", socket.id);

    // Егер күтіп тұрған ойыншы шығып кетсе
    if (waitingPlayer && waitingPlayer.socket.id === socket.id) {
      waitingPlayer = null;
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
