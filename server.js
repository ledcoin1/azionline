// ================== IMPORTS ==================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// ================== APP / SERVER ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// public/index.html үшін
app.use(express.static("public"));

function getCardSuit(card) {
  return card.slice(-1); // ♠ ♥ ♦ ♣
}

function getCardRank(card) {
  return card.slice(0, -1); // 6,7,8,9,10,J,Q,K,A
}

function getCardPower(rank) {
  const order = ["6","7","8","9","10","J","Q","K","A"];
  return order.indexOf(rank);
}

function isValidMove(card, hand, turns, trump) {
  if (turns.length === 0) return true;

  const leadSuit = getCardSuit(turns[0].card);
  const cardSuit = getCardSuit(card);
  const trumpSuit = getCardSuit(trump);

  const hasLeadSuit = hand.some(c => getCardSuit(c) === leadSuit);
  if (hasLeadSuit) return cardSuit === leadSuit;

  const hasTrump = hand.some(c => getCardSuit(c) === trumpSuit);
  if (hasTrump) return cardSuit === trumpSuit;

  return true;
}

function determineTrickWinner(turns, trump) {
  const trumpSuit = getCardSuit(trump);
  let winner = turns[0];

  for (const turn of turns.slice(1)) {
    const winSuit = getCardSuit(winner.card);
    const turnSuit = getCardSuit(turn.card);

    if (turnSuit === trumpSuit && winSuit !== trumpSuit) {
      winner = turn;
      continue;
    }

    if (turnSuit === winSuit &&
        getCardPower(getCardRank(turn.card)) >
        getCardPower(getCardRank(winner.card))) {
      winner = turn;
    }
  }

  return winner.playerId;
}

// ================== CARDS ==================
function createDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const values = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const deck = [];
  for (let suit of suits) for (let value of values) deck.push(value + suit);
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

// ================== DATA ==================
const lobby = [];
const rooms = {};

io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  // ---------- Играть батырмасы ----------
  socket.on("play", () => {
    console.log("▶️ Play pressed:", socket.id);

    if (!lobby.includes(socket.id)) lobby.push(socket.id);

    let roomToJoin = null;
    for (let rId in rooms) {
      const r = rooms[rId];
      if (r.state === "playing" && r.players.length < 5) {
        roomToJoin = r;
        break;
      }
    }

    if (!roomToJoin) {
      const roomId = "room_" + Date.now();
      const playerObj = { id: socket.id, balance: 1000, status: "idle", hand: [] };
      rooms[roomId] = {
        id: roomId,
        state: "playing",
        players: [playerObj],
        turns: [],
        tricksWon: {},
        currentTurn: null,
        round: { activePlayers: [], spectators: [], bank: 0 },
        trump: null
      };
      roomToJoin = rooms[roomId];
      console.log("🏠 New room created:", roomId);
    } else {
      const playerObj = { id: socket.id, balance: 1000, status: "idle", hand: [] };
      roomToJoin.players.push(playerObj);
      console.log("➕ Player added to existing room:", roomToJoin.id);
    }

    socket.join(roomToJoin.id);
    socket.emit("room_joined", { roomId: roomToJoin.id, players: roomToJoin.players });
    askRound(roomToJoin.id);
  });

  // ---------- ROUND ANSWER ----------
  socket.on("round_answer", ({ roomId, answer }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const FIXED_BET = 100;

    if (answer) {
      room.round.activePlayers.push(socket.id);
      player.balance -= FIXED_BET;
      room.round.bank += FIXED_BET;
    } else {
      room.round.spectators.push(socket.id);
    }

    const totalResponses = room.round.activePlayers.length + room.round.spectators.length;
    if (totalResponses === room.players.length || room.round.activePlayers.length === room.players.length) {
      startRound(roomId);
    }
  });

  // ---------- PLAY CARD ----------
  socket.on("play_card", ({ roomId, card }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (!room.round.activePlayers.includes(socket.id)) return;
    if (room.currentTurn !== socket.id) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const index = player.hand.indexOf(card);
    if (index === -1) return;

    if (!isValidMove(card, player.hand, room.turns, room.trump)) {
      socket.emit("error", "Міндетті масть немесе козырь бұзылды!");
      return;
    }

    player.hand.splice(index, 1);
    room.turns.push({ playerId: socket.id, card });
    io.to(roomId).emit("card_played", { playerId: socket.id, card });

    if (room.turns.length === room.round.activePlayers.length) {
      const winnerId = determineTrickWinner(room.turns, room.trump);
      room.tricksWon[winnerId] = (room.tricksWon[winnerId] || 0) + 1;
      io.to(roomId).emit("trick_winner", { winnerId, tricksWon: room.tricksWon });

      room.currentTurn = winnerId;
      room.turns = [];
      io.to(winnerId).emit("your_turn", { message: "Сіз жүрісті ұттыңыз, қайта жүресіз" });

      if (room.tricksWon[winnerId] >= 2) {
        const winner = room.players.find(p => p.id === winnerId);
        winner.balance += room.round.bank;

        io.to(roomId).emit("round_ended", {
          winnerId,
          bank: room.round.bank,
          balances: room.players.map(p => ({ id: p.id, balance: p.balance }))
        });

        console.log(`🎉 Round over! Winner: ${winnerId}, bank: ${room.round.bank}`);

        room.turns = [];
        room.tricksWon = {};
        room.currentTurn = null;
        room.round = { activePlayers: [], spectators: [], bank: 0 };

        askRound(roomId);
      }

    } else {
      const currentIndex = room.round.activePlayers.indexOf(socket.id);
      const nextIndex = (currentIndex + 1) % room.round.activePlayers.length;
      const nextPlayerId = room.round.activePlayers[nextIndex];
      room.currentTurn = nextPlayerId;
      io.to(nextPlayerId).emit("your_turn", { message: "Сіздің кезегіңіз" });
    }
  });

  // ---------- DISCONNECT ----------
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    const index = lobby.indexOf(socket.id);
    if (index !== -1) lobby.splice(index, 1);

    const room = Object.values(rooms).find(r =>
      r.players.some(p => p.id === socket.id)
    );
    if (!room) return;

    if (room.round && room.round.activePlayers.includes(socket.id)) {
      room.round.activePlayers = room.round.activePlayers.filter(id => id !== socket.id);
      console.log(`💥 ${socket.id} left during round, stake stays in bank.`);

      if (room.round.activePlayers.length === 1) {
        const winnerId = room.round.activePlayers[0];
        const winner = room.players.find(p => p.id === winnerId);
        winner.balance += room.round.bank;

        io.to(room.id).emit("round_ended", {
          winnerId,
          bank: room.round.bank,
          balances: room.players.map(p => ({ id: p.id, balance: p.balance }))
        });

        console.log(`🎉 Only one player left, auto-winner: ${winnerId}`);

        room.turns = [];
        room.tricksWon = {};
        room.currentTurn = null;
        room.round = { activePlayers: [], spectators: [], bank: 0 };
      }
    }
  });
});

// ---------- Раунд сұрағы функциясы ----------
function askRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.round.activePlayers = [];
  room.round.spectators = [];

  io.to(roomId).emit("ask_round", {
    message: `Раундқа қатысасыз ба?`,
    players: room.players.map(p => p.id)
  });
}

// ---------- Раунд бастау ----------
function startRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (!room.deck || room.deck.length < room.round.activePlayers.length * 3) {
    room.deck = createDeck();
    shuffle(room.deck);
    room.trump = room.deck[room.deck.length - 1];
  }

  room.players.forEach(p => {
    if (room.round.activePlayers.includes(p.id)) {
      p.hand = dealHand(room.deck, 3);
    }
  });

  room.currentTurn = room.round.activePlayers[0];

  io.to(roomId).emit("round_started", {
    message: "Раунд басталды!",
    bank: room.round.bank,
    activePlayers: room.round.activePlayers,
    spectators: room.round.spectators,
    trump: room.trump
  });

  console.log(`🎮 Round started in room: ${roomId}, trump: ${room.trump}`);
}

// ---------- Колодадан картаны тарату ----------
function dealHand(deck, handSize = 3) {
  const hand = [];
  for (let i = 0; i < handSize; i++) {
    if (deck.length === 0) break;
    hand.push(deck.pop());
  }
  return hand;
}

// ================== SERVER START ==================
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
