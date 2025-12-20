const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/* ========= DATA ========= */

let users = {};
let waiting = null;
let rooms = {};

/* ========= CARD LOGIC ========= */

const suits = ["♠", "♥", "♦", "♣"];
const values = [6,7,8,9,10,11,12,13,14];

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function createDeck() {
  const deck = [];
  for (let s of suits) {
    for (let v of values) {
      deck.push({ suit: s, value: v });
    }
  }
  shuffle(deck);
  return deck;
}

function beats(cardA, cardB, trump, leadSuit) {
  if (cardA.suit === cardB.suit) return cardA.value > cardB.value;
  if (cardA.suit === trump && cardB.suit !== trump) return true;
  if (cardA.suit !== trump && cardB.suit === trump) return false;
  if (cardA.suit === leadSuit) return true;
  return false;
}

/* ========= SOCKET ========= */

io.on("connection", socket => {

  socket.on("joinGame", ({ userId }) => {

    if (!users[userId]) users[userId] = { balance: 1000 };

    if (!waiting) {
      waiting = { userId, roomId: "room_" + Date.now() };
      socket.join(waiting.roomId);
      socket.emit("waiting");
      return;
    }

    const roomId = waiting.roomId;
    const p1 = waiting.userId;
    const p2 = userId;
    waiting = null;

    const deck = createDeck();
    const trump = deck.pop().suit;

    rooms[roomId] = {
      players: [p1, p2],
      hands: {
        [p1]: deck.splice(0,3),
        [p2]: deck.splice(0,3)
      },
      trump,
      turn: p1,
      table: [],
      tricks: { [p1]: 0, [p2]: 0 }
    };

    socket.join(roomId);

    io.to(roomId).emit("start", rooms[roomId]);
  });

  socket.on("playCard", ({ roomId, userId, cardIndex }) => {
    const room = rooms[roomId];
    if (!room || room.turn !== userId) return;

    const card = room.hands[userId].splice(cardIndex, 1)[0];
    room.table.push({ userId, card });

    const other = room.players.find(p => p !== userId);
    room.turn = other;

    if (room.table.length === 2) {
      const [a, b] = room.table;
      const leadSuit = a.card.suit;

      const win =
        beats(a.card, b.card, room.trump, leadSuit)
          ? a.userId
          : b.userId;

      room.tricks[win]++;
      room.turn = win;
      room.table = [];
    }

    if (
      room.hands[p1]?.length === 0 &&
      room.hands[p2]?.length === 0
    ) {
      io.to(roomId).emit("gameEnd", room.tricks);
      delete rooms[roomId];
      return;
    }

    io.to(roomId).emit("update", room);
  });
});

server.listen(process.env.PORT || 3000);
