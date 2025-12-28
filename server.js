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
    players: [],  // {id, name, balance}
    status: "waiting",
    turnIndex: null
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

    io.to(room.id).emit("room_update", { players: room.players, status: room.status });

    // 3 ойыншы қосылғанда ойын басталады
    if (room.players.length === 3) {
      room.status = "started";
      room.turnIndex = 0;
      io.to(room.id).emit("game_started", { roomId: room.id, players: room.players });

      // Бірінші ойыншыға сигнал
      const firstPlayer = room.players[room.turnIndex];
      io.to(firstPlayer.id).emit("your_turn", { message: "Сіздің кезегіңіз! 50–150 арасында сан таңдаңыз." });
    }
  });

  // Бірінші ойыншыдан ставка қабылдау
  socket.on("player_choice", (data) => {
    const room = findRoomBySocket(socket);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const chosenNumber = data.number;

    if (player.balance < chosenNumber) {
      socket.emit("error_message", { message: "Баланс жеткіліксіз!" });
      return;
    }

    // Баланстан алу
    player.balance -= chosenNumber;

    // Барлығына жаңарту
    io.to(room.id).emit("room_update", { players: room.players, status: room.status });
    io.to(room.id).emit("log_update", { msg: `${player.name} ставка тікті: ${chosenNumber}` });

    // Келесі ойыншыға сигнал: 2 есе көбейтілген сан
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    const nextPlayer = room.players[room.turnIndex];
    io.to(nextPlayer.id).emit("your_turn", { 
      message: `Сіздің кезегіңіз! Алдыңғы ставка 2 есе көбейтілді: ${chosenNumber * 2}`,
      previousNumber: chosenNumber * 2
    });
  });

  // 2-ші ойыншы келісім/отбой сигнал
  socket.on("player_decision", (data) => {
    const room = findRoomBySocket(socket);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    io.to(room.id).emit("log_update", { msg: `${player.name} шешімі: ${data.decision}` });

    // Мұнда келесі ойыншыға кезекті беру немесе ойын логикасын жалғастыруға болады
  });

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
