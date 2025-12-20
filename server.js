const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/* ================= DATA ================= */

let users = {}; 
// users[userId] = { balance }

let waitingPlayer = null;

let rooms = {};
// rooms[roomId] = { players }

/* ================= AZI LOGIC ================= */

function randomCard() {
  return Math.floor(Math.random() * 10) + 1; // 1–10
}

function dealCards() {
  return [randomCard(), randomCard(), randomCard()];
}

function score(cards) {
  return cards.reduce((a, b) => a + b, 0) % 10;
}

/* ================= SOCKET ================= */

io.on("connection", socket => {

  socket.on("joinGame", ({ userId }) => {

    // Баланс жоқ болса → береміз
    if (!users[userId]) {
      users[userId] = { balance: 1000 };
    }

    // Егер ешкім күтпесе
    if (!waitingPlayer) {
      waitingPlayer = {
        roomId: "room_" + Date.now(),
        userId
      };

      socket.join(waitingPlayer.roomId);

      socket.emit("waiting", {
        balance: users[userId].balance
      });
      return;
    }

    /* ===== ЕКІНШІ ОЙЫНШЫ КЕЛДІ ===== */

    const roomId = waitingPlayer.roomId;
    const p1 = waitingPlayer.userId;
    const p2 = userId;

    waitingPlayer = null;

    rooms[roomId] = { players: [p1, p2] };
    socket.join(roomId);

    // Карта тарату
    const cards1 = dealCards();
    const cards2 = dealCards();

    const score1 = score(cards1);
    const score2 = score(cards2);

    io.to(roomId).emit("gameStarted", {
      roomId,
      players: [p1, p2],
      cards: {
        [p1]: cards1,
        [p2]: cards2
      },
      scores: {
        [p1]: score1,
        [p2]: score2
      }
    });
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
