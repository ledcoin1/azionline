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

const rooms = {};

function createRoom() {
  const roomId = "room-" + Date.now();
  rooms[roomId] = {
    id: roomId,
    players: [],
    status: "waiting"
  };
  return rooms[roomId];
}

io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  socket.on("join", (data) => {
    let room = Object.values(rooms).find(
      r => r.status === "waiting" && r.players.length < 3
    );
    if (!room) room = createRoom();

    const player = {
      id: socket.id,
      telegramId: data.telegramId,
      username: data.username,
      balance: 1000
    };

    room.players.push(player);
    socket.join(room.id);

    socket.emit("joined", { balance: 1000 });

    console.log("JOIN:", player.username);

    if (room.players.length === 3) {
      room.status = "started";
      io.to(room.id).emit("room_opened", {
        roomId: room.id,
        players: room.players
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log("SERVER RUNNING ON", PORT)
);
