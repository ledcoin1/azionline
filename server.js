const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let waitingPlayer = null;
const rooms = {}; // бөлмелерді сақтау

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

      first.socket.emit("opponentFound", { opponentId: userId });
      socket.emit("opponentFound", { opponentId: first.userId });

      // Room жасау
      const roomId = first.socket.id + "#" + socket.id;
      rooms[roomId] = {
        players: [
          { socket: first.socket, userId: first.userId, hand: [], ready: false },
          { socket: socket, userId: userId, hand: [], ready: false }
        ],
        currentBet: null,
        betStage: null
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

    // -------------------------
    // 36 карта жасау және shuffle
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

    // карталарды клиентке жіберу
    room.players.forEach(p => {
      p.socket.emit("startGame", { hand: p.hand, trump: trump });
    });

    // -------------------------
    // Ставка логикасы басталады
    room.currentBet = null;
    room.betStage = 'first';

    // Бірінші ойыншыдан сұрау
    const firstPlayer = room.players[0];
    const secondPlayer = room.players[1];
    firstPlayer.socket.emit('askBet', { min: 25, max: 50 });

    // Бірінші ойыншы ставка бергенде
    firstPlayer.socket.once('betResponse', ({ accept, amount }) => {
      if (amount < 25 || amount > 50) {
        firstPlayer.socket.emit('message', 'Ставка 25–50 арасында болуы керек');
        return;
      }

      room.currentBet = amount;
      room.betStage = 'second';

      // Екінші ойыншыдан сұрау (ставка екі еселенеді)
      secondPlayer.socket.emit('askBet', { amount: amount * 2 });

      // Екінші ойыншы жауап береді
      secondPlayer.socket.once('betResponse', ({ accept }) => {
        if (!accept) {
          // Отбой басса, бірінші жеңеді
          firstPlayer.socket.emit('message', 'Қарсылас отбой басты. Сіз жеңдіңіз!');
          secondPlayer.socket.emit('message', 'Сіз отбой басып, ойынды аяқтадыңыз.');
          room.betStage = null; // тазалау
          return;
        }

        // Келіссе, ойын басталады
        room.betStage = 'done';
        room.players.forEach(p => p.socket.emit('message', `Ойын басталды! Ставка: ${room.currentBet}`));
        // Мұнда нақты ойын логикасын жалғастыруға болады
      });
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
