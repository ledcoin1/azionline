const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

// Комната жасау
function createRoom() {
  const roomId = "room-" + Date.now();
  rooms[roomId] = {
    id: roomId,
    players: [],        // {id, name, balance}
    status: "waiting"   // waiting | started
  };
  return rooms[roomId];
}

// Кімнің кім екенін табу
function findRoomBySocket(socket) {
  return Object.values(rooms).find(room =>
    room.players.some(p => p.id === socket.id)
  );
}

io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

  // JOIN сигнал
  socket.on("join", (playerName) => {
    let room = Object.values(rooms).find(r => r.status === "waiting" && r.players.length < 3);

    if (!room) room = createRoom();

    room.players.push({ id: socket.id, name: playerName, balance: 1000 });
    socket.join(room.id);

    console.log(`${playerName} қосылды → ${room.id} (${room.players.length}/3)`);

    io.to(room.id).emit("room_update", {
      roomId: room.id,
      players: room.players,
      status: room.status
    });

    // 3 ойыншы қосылғанда ғана ойын басталады
    if (room.players.length === 3) {
      room.status = "started";
      console.log("Ойын басталды:", room.id);
      io.to(room.id).emit("game_started", {
        roomId: room.id,
        players: room.players
      });
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    io.to(room.id).emit("room_update", { players: room.players, status: room.status });

    if (room.players.length === 0) {
      delete rooms[room.id];
      console.log("Комната өшірілді:", room.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server ONLINE on port", PORT));

