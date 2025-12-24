const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// Комнаталар
let rooms = {};

// 36 карталық колода жасау
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

// Жаңа комната жасау
function createRoom() {
  const roomId = `room-${Date.now()}`;
  rooms[roomId] = {
    players: [],
    deck: [],
    status: "waiting", // waiting / started / finished
    trump: null,
    turnIndex: 0 // кімнің кезегі
  };
  console.log("Жаңа комната ашылды:", roomId);
  return roomId;
}

// Карталарды тарату функциясы
function distributeCards(roomId) {
  const room = rooms[roomId];
  const deck = createDeck();
  deck.sort(() => Math.random() - 0.5); // shuffle
  room.deck = deck;

  // Әр ойыншыға 3 карта беру
  room.players.forEach(player => {
    player.hand = deck.splice(0, 3);
  });

  // Көзір – соңғы карта
  room.trump = deck.pop();
  console.log(`Комната ${roomId} карталар таралды, көзір:`, room.trump);
}

// Кезек бойынша ойыншыны таңдау
function getCurrentPlayer(room) {
  return room.players[room.turnIndex];
}

// Келесі ойыншыға кезек беру
function nextTurn(room) {
  room.turnIndex = (room.turnIndex + 1) % room.players.length;
  io.to(room.id).emit("turn", room.players[room.turnIndex].id);
}

// Ойын аяқталуын тексеру
function checkGameOver(roomId) {
  const room = rooms[roomId];
  const allHandsEmpty = room.players.every(p => !p.hand || p.hand.length === 0);
  if (allHandsEmpty) {
    room.status = "finished";
    io.to(roomId).emit("game over", "Ойын аяқталды! 🎉");
    console.log(`Комната ${roomId} ойын аяқталды`);
  }
}

// Клиент қосылды
io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

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

    const room = rooms[roomId];
    room.id = roomId; // room объектінде id сақтау

    // Бір телеграм аккаунт тек бір рет қосылады
    if (!room.players.some(p => p.id === socket.id)) {
      room.players.push({ id: socket.id, name: playerName });
      socket.join(roomId);
      console.log(`${playerName} қосылды комнатаға ${roomId}`);

      // Егер 2+ адам қосылса → ойын бастау
      if (room.players.length >= 2 && room.status === "waiting") {
        room.status = "started";
        distributeCards(roomId);
        io.to(roomId).emit("room started", room.players.map(p => ({
          ...p,
          hand: p.hand
        })));
        io.to(roomId).emit("trump", room.trump);
        io.to(roomId).emit("turn", room.players[room.turnIndex].id);
      }

      io.to(roomId).emit("update players", room.players);
    } else {
      socket.emit("error", "Сіз осы комнатада барсыз");
    }
  });

  // Ойыншы карта ойнады
  socket.on("play card", ({ roomId, card }) => {
    const room = rooms[roomId];
    if (!room || room.status !== "started") return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // Кезектегі ойыншы тек өз кезегінде ойнай алады
    if (room.players[room.turnIndex].id !== socket.id) {
      socket.emit("error", "Сіз кезек емес!");
      return;
    }

    // Карта қолдан жойылады
    const cardIndex = player.hand.findIndex(c => c.value === card.value && c.suit === card.suit);
    if (cardIndex === -1) {
      socket.emit("error", "Сіздің қолыңызда бұл карта жоқ!");
      return;
    }
    player.hand.splice(cardIndex, 1);

    // Барлық ойыншыларға карта ойнағаны туралы хабарлау
    io.to(roomId).emit("card played", { playerId: player.id, card });

    // Кезекті басқа ойыншыға беру
    nextTurn(room);

    // Ойын аяқталуын тексеру
    checkGameOver(roomId);
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
