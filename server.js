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

// --- Комнаталар ---
const rooms = {};

// --- Комната жасау ---
function createRoom() {
  const roomId = "room-" + Date.now();
  rooms[roomId] = {
    id: roomId,
    players: [],
    status: "waiting",
    deck: [],
    trump: null,
    currentTurnIndex: null
  };
  return rooms[roomId];
}

// --- Кімнің кім екенін табу ---
function findRoomBySocket(socket) {
  return Object.values(rooms).find(room =>
    room.players.some(p => p.id === socket.id)
  );
}

// --- Колода жасау ---
function createDeck() {
  const suits = ["hearts", "diamonds", "clubs", "spades"];
  const values = [6, 7, 8, 9, 10, "J", "Q", "K", "A"];
  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

// --- Колоданы араластыру ---
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// --- Раундтағы кезекті ауыстыру ---
function nextTurn(room) {
  const activePlayers = room.players.filter(p => !p.folded);
  if (activePlayers.length === 0) return;

  if (room.currentTurnIndex == null) {
    room.currentTurnIndex = Math.floor(Math.random() * activePlayers.length);
  } else {
    room.currentTurnIndex = (room.currentTurnIndex + 1) % activePlayers.length;
  }

  const currentPlayer = activePlayers[room.currentTurnIndex];
  io.to(currentPlayer.id).emit("your_turn", { message: "Сіздің кезегіңіз!" });
}

// --- Socket.IO connection ---
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  // --- JOIN сигнал ---
  socket.on("join", (data) => {
    let room = Object.values(rooms).find(r => r.status === "waiting" && r.players.length < 3);
    if (!room) room = createRoom();

    const player = {
      id: socket.id,
      telegramId: data.telegramId,
      username: data.username,
      balance: 1000,
      folded: false,
      cards: []
    };

    room.players.push(player);
    socket.join(room.id);

    // Ойыншыға бастапқы баланс
    socket.emit("joined", { balance: player.balance });

    console.log("JOIN:", player.username);

    if (room.players.length === 3) {
      room.status = "started";

      // Колоданы жасау, араластыру
      room.deck = shuffle(createDeck());
      room.trump = room.deck[room.deck.length - 1];

      // Барлық 3 ойыншыға бірдей 500 ставка жіберу
      io.to(room.id).emit("start_bet", { bet: 500, trump: room.trump });

      // Барлық ойыншыларға комта ашылды сигнал
      io.to(room.id).emit("room_opened", {
        roomId: room.id,
        players: room.players
      });

      console.log(`ROOM STARTED: ${room.id}`);

      // Бірінші рандом жүрісті бастау
      nextTurn(room);
    }
  });

  // --- accept сигнал ---
  socket.on("player_accept", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.balance -= 500;
    player.folded = false;

    io.to(room.id).emit("player_accepted", { username: player.username });

    // Карталарды тарату тек accept басқан ойыншыларға
    const activePlayers = room.players.filter(p => !p.folded);
    activePlayers.forEach(p => {
      p.cards = room.deck.splice(0, 3);
      io.to(p.id).emit("your_cards", { cards: p.cards, trump: room.trump });
    });

    // Келесі жүрісті беру
    nextTurn(room);
  });

  // --- fold сигнал ---
  socket.on("player_fold", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.folded = true;

    io.to(room.id).emit("player_folded", { username: player.username });

    // Келесі жүрісті беру
    nextTurn(room);
  });
});

// --- Серверді іске қосу ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log("SERVER RUNNING ON PORT", PORT)
);
