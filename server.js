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

  });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));



