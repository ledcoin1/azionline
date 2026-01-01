const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const lobby = [];        // күтіп тұрған ойыншылар
const rooms = {};        // ашылған комнаталар

// ===== Socket логика =====
io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  // Играть батырмасы
  socket.on("play", () => {
    console.log("▶️ Play pressed:", socket.id);

    // lobby-де жоқ болса ғана қосамыз
    if (!lobby.includes(socket.id)) {
      lobby.push(socket.id);
    }

    // 3 адам жиналды ма?
    if (lobby.length >= 3) {
      const playersIds = lobby.splice(0, 3);
      const roomId = "room_" + Date.now();

      rooms[roomId] = {
        id: roomId,
        players: playersIds.map(id => ({
          id,
          balance: 1000
        }))
      };

      // ойыншыларды комнатаға қосу
      playersIds.forEach(id => {
        const playerSocket = io.sockets.sockets.get(id);
        if (playerSocket) {
          playerSocket.join(roomId);
          playerSocket.emit("room_joined", {
            roomId,
            players: rooms[roomId].players
          });
        }
      });

      console.log("🏠 Room created:", roomId);
    } else {
      socket.emit("waiting", {
        count: lobby.length,
        needed: 3
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    // lobby-ден өшіру
    const index = lobby.indexOf(socket.id);
    if (index !== -1) lobby.splice(index, 1);
  });
});

// ===== Server start =====
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
