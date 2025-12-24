const express = require("express");   // сайт логикасы
const http = require("http");         // сервер
const { Server } = require("socket.io"); // онлайн байланыс

// сервер жасау
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public")); // public/index.html ашылады

// Бірінші ойыншыны сақтау
let waitingPlayer = null;

io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

  socket.on("joinGame", ({ userId }) => {
    console.log("Ойынға қосылды:", userId);

    if (!waitingPlayer) {
      // 1-ойыншы
      waitingPlayer = { socket, userId };
      socket.emit(
        "message",
        "Сіз бірінші ойыншысыз, қарсылас күтілуде..."
      );
    } else {
      // 2-ойыншы
      const first = waitingPlayer;
      waitingPlayer = null;

      // Хабар жіберу
      first.socket.emit(
        "message",
        `Қарсылас табылды! Екінші ойыншы: ${userId}`
      );

      socket.emit(
        "message",
        `Қарсылас табылды! Бірінші ойыншы: ${first.userId}`
      );

      // Game экранға өту сигналы
      first.socket.emit("opponentFound", { opponentId: userId });
      socket.emit("opponentFound", { opponentId: first.userId });
 // ---------------------- МЫНА ЖЕРДЕН БАСТАЙДЫ ----------------------

// Room жасау
const roomId = first.socket.id + "#" + socket.id;
rooms[roomId] = {
  players: [
    { socket: first.socket, userId: first.userId, hand: [], ready: false },
    { socket: socket, userId: userId, hand: [], ready: false }
  ]
};

// Клиентке roomId жіберу (ready үшін қажет)
first.socket.emit("roomJoined", { roomId });
socket.emit("roomJoined", { roomId });

// ready событиесі
socket.on("ready", ({ roomId }) => {
  const room = rooms[roomId];
  if (!room) return;

  // ready белгілеу
  const player = room.players.find(p => p.socket.id === socket.id);
  if (!player) return;
  player.ready = true;

  io.to(roomId).emit("message", `${player.userId} дайын`);

  // екеуі де дайын ба?
  const allReady = room.players.every(p => p.ready);
  if (!allReady) return;

  // ----------------------------
  // 36 карта жасау
  const suits = ["♠","♥","♦","♣"];
  const ranks = ["6","7","8","9","10","J","Q","K","A"];

  let deck = [];
  suits.forEach(suit => ranks.forEach(rank => deck.push({ suit, rank })));

  // shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // көзір карта (1 карта)
  const trump = deck.shift();

  // әр ойыншыға 3 карта
  room.players[0].hand = deck.slice(0,3);
  room.players[1].hand = deck.slice(3,6);

  // deck-тен қалғаны (ойын барысында қажет)
  room.deck = deck.slice(6);
  room.trump = trump;

  // карталарды клиентке жіберу
  room.players.forEach(p => {
    p.socket.emit("startGame", {
      hand: p.hand,
      trump: trump
    });
  });
});


socket.on("disconnect", () => {
    if (waitingPlayer && waitingPlayer.socket.id === socket.id) {
      waitingPlayer = null;
    }
  });

});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

