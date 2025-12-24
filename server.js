const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Комнаталар
let rooms = {};

// 🔹 36 карталық колода жасау
function createDeck() {
  const suits = ["hearts", "diamonds", "clubs", "spades"];
  const values = ["6","7","8","9","10","J","Q","K","A"];
  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

// 🔹 Жаңа комната жасау
function createRoom() {
  const roomId = `room-${Date.now()}`;
  rooms[roomId] = {
    players: [],
    deck: [],
    status: "waiting",
    turn: null,
    trump: null // көзір
  };
  console.log("Жаңа комната ашылды:", roomId);
  return roomId;
}

// 🔹 Карталарды тарату функциясы
function distributeCards(roomId) {
  const deck = createDeck();
  deck.sort(() => Math.random() - 0.5); // shuffle
  rooms[roomId].deck = deck;

  // Әр ойыншыға 3 карта беру
  rooms[roomId].players.forEach(player => {
    player.hand = deck.splice(0, 3);
  });

  // Көзір – соңғы карта
  rooms[roomId].trump = deck.pop();
  console.log(`Комната ${roomId} карталар таралды, көзір:`, rooms[roomId].trump);
}

// 🔹 Клиент қосылды
io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

  // Играть батырмасы басылғанда
  socket.on("join game", (playerName) => {
    let roomId = null;

    // Бос комната іздеу
    for (const id in rooms) {
      if (rooms[id].players.length < 5 && rooms[id].status === "waiting") {
        roomId = id;
        break;
      }
    }

    // Бос комната жоқ болса → жаңа комната ашу
    if (!roomId) {
      roomId = createRoom();
    }

    // Бір телеграм аккаунт тек бір рет қосылады
    if (!rooms[roomId].players.some(p => p.id === socket.id)) {
      rooms[roomId].players.push({ id: socket.id, name: playerName });
      socket.join(roomId);
      console.log(`${playerName} қосылды комнатаға ${roomId}`);

      // Егер 2+ адам қосылса → ойын бастау
      if (rooms[roomId].players.length >= 2 && rooms[roomId].status === "waiting") {
        rooms[roomId].status = "started";

        // ✅ Карталарды тарату және көзір орнату
        distributeCards(roomId);

        io.to(roomId).emit("room started", rooms[roomId].players);
        console.log(`Комната ${roomId} ашылды!`);
      }

      // Барлық ойыншыларға кім кімде екенін жіберу
      io.to(roomId).emit("update players", rooms[roomId].players);
    } else {
      socket.emit("error", "Сіз осы комнатада барсыз");
    }
  });

  // Disconnect болғанда
  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(p => p.id !== socket.id);

      if (room.players.length === 0) {
        delete rooms[roomId];
        console.log(`Комната ${roomId} жабылды`);
      } else {
        io.to(roomId).emit("update players", room.players);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server ONLINE on port", PORT));
