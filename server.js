// ================== IMPORTS ==================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// ================== APP / SERVER ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// public/index.html үшін
app.use(express.static("public"));

// ================== DATA ==================

// lobby — ойынды күтіп тұрған ойыншылар
const lobby = [];

// rooms — ашылған барлық комнаталар
const rooms = {};

// ================== SOCKET LOGIC ==================
io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  // ---------- Играть батырмасы ----------
  socket.on("play", () => {
    console.log("▶️ Play pressed:", socket.id);

    // Егер lobby-де жоқ болса ғана қосамыз
    if (!lobby.includes(socket.id)) {
      lobby.push(socket.id);
    }

    // ---------- 3 адам жиналды ма? ----------
    if (lobby.length >= 3) {

      // Алғашқы 3 адамды аламыз
      const playersIds = lobby.splice(0, 3);

      // Уникальный room id
      const roomId = "room_" + Date.now();

      // ---------- ROOM ҚҰРУ ----------
      rooms[roomId] = {
        id: roomId,

        // бастапқы күй
        state: "ready",

        // 3 ойыншы
        players: playersIds.map(id => ({
          id: id,          // socket.id
          balance: 1000,   // бастапқы баланс
          status: "idle"   // әзірше ештеңе істеп тұрған жоқ
        })),

        // 1 раунд ойнаймыз ба? деген сұраққа арналған
        roundRequest: {
          active: false,   // сұрақ белсенді ме
          answers: {}      // жауаптар { socketId: true/false }
        }
      };

      console.log("🏠 Room created:", roomId);

      // ---------- ОЙЫНШЫЛАРДЫ ROOM-ҒА ҚОСУ ----------
      playersIds.forEach(id => {
        const playerSocket = io.sockets.sockets.get(id);
        if (playerSocket) {
          playerSocket.join(roomId);

          // Клиентке: сен осы room-ға кірдің
          playerSocket.emit("room_joined", {
            roomId,
            players: rooms[roomId].players
          });
        }
      });

      // ---------- 1 СЕКУНДТАН КЕЙІН ОЙЫН БАСТАЛАДЫ ----------
      setTimeout(() => {
        // Егер room өшіп кетсе — ештеңе істемейміз
        if (!rooms[roomId]) return;

        // Room күйін ауыстырамыз
        rooms[roomId].state = "playing";

        // Клиенттерге: ойын басталды
        io.to(roomId).emit("game_started", {
          roomId
        });

        console.log("🎮 Game started:", roomId);

        // ---------- 1 РАУНД ОЙНАЙМЫЗ БА? ----------
        rooms[roomId].roundRequest.active = true;
        rooms[roomId].roundRequest.answers = {};

        // 3 ойыншыға бірдей сұрақ жіберіледі
        io.to(roomId).emit("ask_round", {
          message: "1 раунд ойнаймыз ба?"
        });

        console.log("❓ Round request sent:", roomId);

      }, 1000);

    } else {
      // ---------- ӘЛІ 3 АДАМ ЖОҚ ----------
      socket.emit("waiting", {
        count: lobby.length,
        needed: 3
      });
    }
  });

  // ---------- DISCONNECT ----------
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    // lobby-ден өшіреміз
    const index = lobby.indexOf(socket.id);
    if (index !== -1) {
      lobby.splice(index, 1);
    }
  });
});

// ================== SERVER START ==================
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
