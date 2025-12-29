const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

/* =====================
   DATA STORAGE
===================== */

// Күтіп тұрған ойыншылар
const waitingPlayers = [];

// Комнаталар
const rooms = {};

/* =====================
   ROOM CREATE
===================== */

function createRoom(players) {
  const roomId = "room_" + Date.now();

  rooms[roomId] = {
    id: roomId,
    players: players, // [{socketId, telegramId, username, balance}]
    status: "room_opened"
  };

  return rooms[roomId];
}

/* =====================
   SOCKET CONNECTION
===================== */

io.on("connection", (socket) => {
  console.log("🟢 Клиент қосылды:", socket.id);

  /* ===== JOIN FROM TELEGRAM ===== */
  socket.on("join", (data) => {
    const { telegramId, username } = data;

    // Қауіпсіздік тексеру
    if (!telegramId || !username) return;

    // Ойыншы объектісі
    const player = {
      socketId: socket.id,
      telegramId,
      username,
      balance: 1000
    };

    // Lobby-ге қосу
    waitingPlayers.push(player);

    console.log("👤 Күтіп тұрған ойыншы:", username);

    // Ойыншыға балансын жіберу
    socket.emit("joined", {
      message: "Сіз lobby-ге қосылдыңыз",
      balance: player.balance
    });

    /* ===== 3 ОЙЫНШЫ БОЛҒАНДА ===== */
    if (waitingPlayers.length === 3) {
      const roomPlayers = waitingPlayers.splice(0, 3);

      const room = createRoom(roomPlayers);

      // Socket-тарды комнатаға қосу
      room.players.forEach((p) => {
        const playerSocket = io.sockets.sockets.get(p.socketId);
        if (playerSocket) {
          playerSocket.join(room.id);
        }
      });

      console.log("🏠 Комната ашылды:", room.id);

      // 3 ойыншыға БІРДЕЙ сигнал
      io.to(room.id).emit("room_opened", {
        roomId: room.id,
        players: room.players.map(p => ({
          telegramId: p.telegramId,
          username: p.username,
          balance: p.balance
        })),
        message: "Комната ашылды. 3 ойыншы жиналды."
      });
    }
  });

  /* ===== DISCONNECT ===== */
  socket.on("disconnect", () => {
    console.log("🔴 Клиент шықты:", socket.id);

    // Lobby-ден өшіру
    const index = waitingPlayers.findIndex(p => p.socketId === socket.id);
    if (index !== -1) {
      waitingPlayers.splice(index, 1);
    }
  });
});

/* =====================
   SERVER START
===================== */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Server ONLINE on port", PORT);
});
