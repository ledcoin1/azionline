const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static("public"));

// Комнаталар
const rooms = {};

// Комната жасау
function createRoom() {
  const roomId = "room-" + Date.now();
  rooms[roomId] = {
    id: roomId,
    players: [],
    status: "waiting"
  };
  return rooms[roomId];
}

// Socket.IO қосылым
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  // JOIN сигнал
  socket.on("join", (data) => {
    // Бос комната іздеу
    let room = Object.values(rooms).find(
      r => r.status === "waiting" && r.players.length < 3
    );
    if (!room) room = createRoom();

    // Ойыншы объектісі
    const player = {
      id: socket.id,
      telegramId: data.telegramId,
      username: data.username,
      balance: 1000
    };

    // Комнатаға қосу
    room.players.push(player);
    socket.join(room.id);

    // Ойыншыға бастапқы баланс жіберу
    socket.emit("joined", { balance: player.balance });

    console.log("JOIN:", player.username);

    // Егер 3 ойыншы қосылса
    if (room.players.length === 3) {
      room.status = "started";

      // Барлық 3 ойыншыға бірдей 500 ставка жіберу
      io.to(room.id).emit("start_bet", { bet: 500 });

      // Барлық ойыншыларға комта ашылды сигнал
      io.to(room.id).emit("room_opened", {
        roomId: room.id,
        players: room.players
      });

      console.log(`ROOM STARTED: ${room.id}`);
    }
  });
});

// Серверді іске қосу
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log("SERVER RUNNING ON PORT", PORT)
);
