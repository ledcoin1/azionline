const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/* ---------------- DATA ---------------- */

let users = {}; 
// users[userId] = { balance: number }

let waitingRoom = null;

let rooms = {};
// rooms[roomId] = { players: [id1, id2] }

/* ---------------- SOCKET ---------------- */

io.on("connection", socket => {

  socket.on("joinGame", ({ userId }) => {

    // 1️⃣ Егер жаңа ойыншы болса – баланс береміз
    if (!users[userId]) {
      users[userId] = { balance: 1000 };
    }

    // 2️⃣ Егер күтіп тұрған адам жоқ болса
    if (!waitingRoom) {
      waitingRoom = {
        roomId: "room_" + Date.now(),
        player: userId
      };

      socket.join(waitingRoom.roomId);

      socket.emit("waiting", {
        balance: users[userId].balance
      });

      return;
    }

    // 3️⃣ Екінші ойыншы келді → комната жасалады
    const roomId = waitingRoom.roomId;
    const player1 = waitingRoom.player;
    const player2 = userId;

    rooms[roomId] = {
      players: [player1, player2]
    };

    socket.join(roomId);

    // Комната бос емес
    waitingRoom = null;

    // 4️⃣ Екеуіне де хабар жіберу
    io.to(roomId).emit("gameStarted", {
      roomId,
      players: rooms[roomId].players,
      balances: {
        [player1]: users[player1].balance,
        [player2]: users[player2].balance
      }
    });
  });

});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
