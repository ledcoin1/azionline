const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let waitingPlayer = null;
const rooms = {}; // <- бұл маңызды

io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

  socket.on("joinGame", ({ userId }) => {
    console.log("Ойынға қосылды:", userId);

    if (!waitingPlayer) {
      waitingPlayer = { socket, userId };
      socket.emit("message", "Сіз бірінші ойыншысыз, қарсылас күтілуде...");
    } else {
      const first = waitingPlayer;
      waitingPlayer = null;

      first.socket.emit("message", `Қарсылас табылды! Екінші ойыншы: ${userId}`);
      socket.emit("message", `Қарсылас табылды! Бірінші ойыншы: ${first.userId}`);

      // Game экранға өту сигналы
      first.socket.emit("opponentFound", { opponentId: userId });
      socket.emit("opponentFound", { opponentId: first.userId });

      // Room жасау
      const roomId = first.socket.id + "#" + socket.id;
      rooms[roomId] = {
        players: [
          { socket: first.socket, userId: first.userId, hand: [], ready: false },
          { socket: socket, userId: userId, hand: [], ready: false }
        ]
      };

      first.socket.emit("roomJoined", { roomId });
      socket.emit("roomJoined", { roomId });
    }
  });

  // ready событиесі
  socket.on("ready", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.socket.id === socket.id);
    if (!player) return;
    player.ready = true;

    io.to(roomId).emit("message", `${player.userId} дайын`);

    const allReady = room.players.every(p => p.ready);
    if (!allReady) return;

    const suits = ["♠","♥","♦","♣"];
    const ranks = ["6","7","8","9","10","J","Q","K","A"];
    let deck = [];
    suits.forEach(suit => ranks.forEach(rank => deck.push({ suit, rank })));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const trump = deck.shift();

    room.players[0].hand = deck.slice(0,3);
    room.players[1].hand = deck.slice(3,6);
    room.deck = deck.slice(6);
    room.trump = trump;

    room.players.forEach(p => {
      p.socket.emit("startGame", { hand: p.hand, trump: trump });
    });
  });

  socket.on("disconnect", () => {
    console.log("Клиент шықты:", socket.id);
    if (waitingPlayer && waitingPlayer.socket.id === socket.id) waitingPlayer = null;
  });

});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
