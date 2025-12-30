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

// --- Колода жасау ---
function createDeck() {
  const suits = ["hearts", "diamonds", "clubs", "spades"];
  const values = ["6","7","8","9","10","J","Q","K","A"];
  const deck = [];
  for (let suit of suits) {
    for (let value of values) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// --- Комната жасау ---
function createRoom() {
  const roomId = "room-" + Date.now();
  rooms[roomId] = {
    id: roomId,
    players: [], // {id, username, balance, roundStatus, cards}
    status: "waiting",
    turnIndex: null,
    deck: [],
    trump: null
  };
  return rooms[roomId];
}

// --- Табу кім қай бөлмеде ---
function findRoomBySocket(socket) {
  return Object.values(rooms).find(room =>
    room.players.some(p => p.id === socket.id)
  );
}

// --- Раунд аяқтау ---
function finishRound(room) {
  const accepted = room.players.filter(p => p.roundStatus === "accepted");
  if (accepted.length === 0) {
    io.to(room.id).emit("round_result", { message: "Ешкім келіспеді!" });
  } else {
    // Accepted ойыншыларға карталар тарату
    const deck = shuffle(createDeck());
    room.trump = deck.pop();
    accepted.forEach(p => {
      p.cards = [deck.pop(), deck.pop(), deck.pop()];
      io.to(p.id).emit("your_cards", { cards: p.cards, trump: room.trump });
    });
    io.to(room.id).emit("round_result", { message: "Раунд басталды!" });
  }

  // Раунд аяқталған соң барлық ойыншылардың статусын қайта баптау
  room.players.forEach(p => p.roundStatus = "waiting");
  room.status = "waiting";
}

// --- Раунд аяқталғанын тексеру ---
function checkRoundEnd(room) {
  const waiting = room.players.some(p => p.roundStatus === "waiting");
  if (!waiting) finishRound(room);
}

// --- Socket.IO connection ---
io.on("connection", socket => {
  console.log("CONNECTED:", socket.id);

  // --- JOIN сигнал ---
  socket.on("join", ({ telegramId, username }) => {
    let room = Object.values(rooms).find(r => r.status === "waiting" && r.players.length < 3);
    if (!room) room = createRoom();

    const player = { id: socket.id, telegramId, username, balance: 1000, roundStatus: "waiting" };
    room.players.push(player);
    socket.join(room.id);

    socket.emit("joined", { balance: player.balance });
    io.to(room.id).emit("room_update", { players: room.players, status: room.status });

    console.log("JOIN:", player.username);

    if (room.players.length === 3) {
      room.status = "started";
      io.to(room.id).emit("room_opened", { roomId: room.id, players: room.players });

      // Барлық accepted/fold жауаптарын сұрау
      room.players.forEach(p => {
        io.to(p.id).emit("start_bet", { bet: 500 }); // мысал ставка
        // Таймер 10 сек ішінде жауап болмаса auto fold
        p.timer = setTimeout(() => {
          if (p.roundStatus === "waiting") {
            p.roundStatus = "folded";
            io.to(room.id).emit("player_auto_fold", { username: p.username });
            checkRoundEnd(room);
          }
        }, 10000);
      });
    }
  });

  // --- Accept ---
  socket.on("accept", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.roundStatus !== "waiting") return;

    clearTimeout(player.timer);
    player.roundStatus = "accepted";
    player.balance -= 500; // accepted ойыншылардың балансынан аламыз
    io.to(room.id).emit("player_accepted", { username: player.username, balance: player.balance });
    checkRoundEnd(room);
  });

  // --- Fold ---
  socket.on("fold", () => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.roundStatus !== "waiting") return;

    clearTimeout(player.timer);
    player.roundStatus = "folded";
    io.to(room.id).emit("player_folded", { username: player.username });
    checkRoundEnd(room);
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("SERVER RUNNING ON PORT", PORT));
