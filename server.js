const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let waitingPlayers = []; // күтіп тұрғандар
let roomCounter = 1;

io.on("connection", (socket) => {
  console.log("🔌 Клиент қосылды:", socket.id);

  socket.on("join", (playerName) => {
    console.log("👉 JOIN:", playerName);

    // Кезекте жоқ болса қосу
    if (!waitingPlayers.find(p => p.id === socket.id)) {
      waitingPlayers.push({
        id: socket.id,
        name: playerName
      });
    }

    // 3 адам жиналса → комната ашу
    if (waitingPlayers.length === 3) {
      const roomId = "room-" + roomCounter++;
      const players = [...waitingPlayers];
      waitingPlayers = [];

      players.forEach(p => {
        const s = io.sockets.sockets.get(p.id);
        if (s) s.join(roomId);
      });

      console.log("🎮 Комната ашылды:", roomId);

      io.to(roomId).emit("room started", {
        roomId,
        players
      });
    } else {
      socket.emit("waiting", waitingPlayers.length);
    }
  });

  socket.on("disconnect", () => {
    waitingPlayers = waitingPlayers.filter(p => p.id !== socket.id);
    console.log("❌ Клиент кетті:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Server ONLINE:", PORT);
});
