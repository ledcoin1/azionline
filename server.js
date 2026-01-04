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

// кім жүрісті ұтты анықтайды
function determineTrickWinner(turns, trump) {
  const trumpSuit = getCardSuit(trump);
  const leadSuit = getCardSuit(turns[0].card);

  let winner = turns[0];

  for (const turn of turns.slice(1)) {
    const winSuit = getCardSuit(winner.card);
    const turnSuit = getCardSuit(turn.card);

    // 1️⃣ козырь козырь емес картаны ұтады
    if (turnSuit === trumpSuit && winSuit !== trumpSuit) {
      winner = turn;
      continue;
    }

    // 2️⃣ бір масть болса — үлкені ұтады
    if (
      turnSuit === winSuit &&
      getCardPower(getCardRank(turn.card)) >
      getCardPower(getCardRank(winner.card))
    ) {
      winner = turn;
    }
  }

  return winner.playerId;
}



// ================== CARDS ==================

// 36 карталық колода жасау
function createDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const values = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const deck = [];

  for (let suit of suits) {
    for (let value of values) {
      deck.push(value + suit);
    }
  }

  return deck;
}

// Карталарды араластыру (Fisher–Yates)
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}



// ================== DATA ==================

// lobby — ойынды күтіп тұрған ойыншылар
const lobby = [];

// rooms — ашылған барлық комнаталар
const rooms = {};

// ================== SOCKET LOGIC ==================
io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  // ---------- Играть батырмасы ----------
 socket.on("play", () => {
  console.log("▶️ Play pressed:", socket.id);

  // Егер lobby-де жоқ болса ғана қосамыз
  if (!lobby.includes(socket.id)) {
    lobby.push(socket.id);
  }

  // ----------2-5 адам ----------
  if (lobby.length >= 2) {
    const playerCount = Math.min(lobby.length, 5);
    const playersIds = lobby.splice(0, playerCount);

    // Уникальный room id
    const roomId = "room_" + Date.now();

    // ---------- ROOM ҚҰРУ ----------
    rooms[roomId] = {
      id: roomId,
      state: "ready",
      players: playersIds.map(id => ({
        id: id,
        balance: 1000,
        status: "idle"
      })),
      turns: [],
      tricksWon: {},
      currentTurn: null,
      round: {
        activePlayers: [],
        spectators: [],
        bank: 0
      }
    };

    console.log("🏠 Room created:", roomId);

    // ---------- ОЙЫНШЫЛАРДЫ ROOM-ҒА ҚОСУ ----------
    playersIds.forEach(id => {
      const playerSocket = io.sockets.sockets.get(id);
      if (playerSocket) {
        playerSocket.join(roomId);
        playerSocket.emit("room_joined", {
          roomId,
          players: rooms[roomId].players
        });
      }
    });

    // ---------- 1 СЕКУНДТАН КЕЙІН РАУНД СҰРАҒЫ ----------
    setTimeout(() => {
      if (!rooms[roomId]) return;

      // Room күйін ауыстырамыз
      rooms[roomId].state = "playing";

      // Клиенттерге: ойын басталды
      io.to(roomId).emit("game_started", { roomId });
      console.log("🎮 Game started:", roomId);

      // ---------- Раундқа дайындық сұрағы ----------
      const FIXED_BET = 100;
      io.to(roomId).emit("ask_round", {
        message: `1 раунд ойнаймыз ба? Ставка: ${FIXED_BET}`
      });

      console.log("❓ Round request sent with fixed bet:", roomId);

    }, 1000);

  } else {
    // ---------- ӘЛІ 2 АДАМ ЖОҚ ----------
    socket.emit("waiting", {
      count: lobby.length,
      needed: 2
    });
  }
});

 
 
 

    // ---------- ROUND ANSWER ----------
  socket.on("round_answer", ({ roomId, answer }) => {
  const room = rooms[roomId];
  if (!room) return;

  const player = room.players.find(p => p.id === socket.id);
  if (!player) return;

  const FIXED_BET = 100;

  // ---------- Иә / жоқ жауаптарды есептеу ----------
  if (answer) {
    // Раундқа кіргендер
    room.round.activePlayers.push(socket.id);

    // Баланстан ставка блоктау
    player.balance -= FIXED_BET;
    room.round.bank += FIXED_BET;
  } else {
    // Spectator
    room.round.spectators.push(socket.id);
  }

  console.log(`📝 Answer from ${socket.id} in ${roomId}: ${answer}`);

  // ---------- Раунд бастау шартын тексеру ----------
  if (room.round.activePlayers.length >= 2) {
    // барлығы дайын болды ма тексеру — барлығы activePlayers жауап берді деп қабылдаймыз
    const totalResponses = room.round.activePlayers.length + room.round.spectators.length;
    const totalPlayers = room.players.length;

    if (totalResponses === totalPlayers || room.round.activePlayers.length === totalPlayers) {
      // ---------- Раунд басталады ----------
      io.to(roomId).emit("round_started", {
        message: "Раунд басталды!",
        bank: room.round.bank,
        activePlayers: room.round.activePlayers,
        spectators: room.round.spectators
      });

      console.log("🎮 Round started in room:", roomId);

      // ---------- Карталарды тарату ----------
      const deck = createDeck();
      shuffle(deck);
      room.deck = deck;

      // Трамп
      room.trump = room.deck[room.deck.length - 1];

      // Карталарды activePlayers-қа беру
      room.players.forEach(p => {
        if (room.round.activePlayers.includes(p.id)) {
          p.hand = room.deck.splice(0, 3);
          io.to(p.id).emit("your_cards", {
            hand: p.hand,
            trump: room.trump
          });
        } else {
          // Spectator көре алады, бірақ картасы жоқ
          io.to(p.id).emit("spectator", {
            message: "Сіз spectator болдыңыз",
            trump: room.trump
          });
        }
      });

      // ---------- Random first turn ----------
      const randomIndex = Math.floor(Math.random() * room.round.activePlayers.length);
      const firstPlayerId = room.round.activePlayers[randomIndex];
      room.currentTurn = firstPlayerId;

      io.to(firstPlayerId).emit("your_turn", {
        message: "Сіз бірінші жүресіз"
      });

      console.log("⚡ First turn:", firstPlayerId);
    }
  }
});


 // ================= PLAY CARD =================
socket.on("play_card", ({ roomId, card }) => {
  const room = rooms[roomId];
  if (!room) return;

  // Тек activePlayers картасын ойнай алады
  if (!room.round.activePlayers.includes(socket.id)) return;
  if (room.currentTurn !== socket.id) return;

  const player = room.players.find(p => p.id === socket.id);
  if (!player) return;

  // Карта қолында бар ма?
  const index = player.hand.indexOf(card);
  if (index === -1) return;

  // Карта ойнау
  player.hand.splice(index, 1);

  // Жүріске қосу
  room.turns.push({ playerId: socket.id, card });
  console.log("🃏 Card played:", socket.id, card);

  // Барлығына көрсету
  io.to(roomId).emit("card_played", { playerId: socket.id, card });

  // ---------- ALL ACTIVE PLAYERS CARD CHECK ----------
  if (room.turns.length === room.round.activePlayers.length) {
    // Жүріс жеңімпазын анықтау
    const winnerId = determineTrickWinner(room.turns, room.trump);
    console.log("🏆 Trick winner:", winnerId);

    // Трик санын санау
    room.tricksWon[winnerId] = (room.tricksWon[winnerId] || 0) + 1;

    io.to(roomId).emit("trick_winner", {
      winnerId,
      tricksWon: room.tricksWon
    });

    // Келесі жүріс — ұтқан ойыншыдан
    room.currentTurn = winnerId;
    room.turns = [];

    io.to(winnerId).emit("your_turn", {
      message: "Сіз жүрісті ұттыңыз, қайта жүресіз"
    });

    // ---------- CHECK ROUND WINNER ----------
    if (room.tricksWon[winnerId] >= 2) {
      const winner = room.players.find(p => p.id === winnerId);
      winner.balance += room.round.bank;

      io.to(roomId).emit("round_ended", {
        winnerId,
        bank: room.round.bank,
        balances: room.players.map(p => ({ id: p.id, balance: p.balance }))
      });

      console.log(`🎉 Round over! Winner: ${winnerId}, bank: ${room.round.bank}`);

      // Раунд жабу
      room.turns = [];
      room.tricksWon = {};
      room.currentTurn = null;
      room.round = { activePlayers: [], spectators: [], bank: 0 };
    }
  } else {
    // ---------- NEXT TURN ----------
    const currentIndex = room.round.activePlayers.indexOf(socket.id);
    const nextIndex = (currentIndex + 1) % room.round.activePlayers.length;
    const nextPlayerId = room.round.activePlayers[nextIndex];

    room.currentTurn = nextPlayerId;
    io.to(nextPlayerId).emit("your_turn", { message: "Сіздің кезегіңіз" });
  }
});


  socket.on("disconnect", () => {
  console.log("❌ User disconnected:", socket.id);

  // lobby-ден өшіреміз
  const index = lobby.indexOf(socket.id);
  if (index !== -1) lobby.splice(index, 1);

  // Қай room-да бар екенін тексеру
  const room = Object.values(rooms).find(r =>
    r.players.some(p => p.id === socket.id)
  );

  if (!room) return;

  // Егер раунд жүріп жатса
  if (room.round && room.round.activePlayers.includes(socket.id)) {
    // Банктен ставка сақталады, ойыншы шығып кетсе ставка күйіп кетеді
    room.round.activePlayers = room.round.activePlayers.filter(id => id !== socket.id);

    console.log(`💥 ${socket.id} left during round, stake stays in bank.`);

    // Егер тек 1 адам қалса — автомат жеңімпаз
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

      // Раунд жабу
      room.turns = [];
      room.tricksWon = {};
      room.currentTurn = null;
      room.round = { activePlayers: [], spectators: [], bank: 0 };
    }
  }
});
});
  

// ================== SERVER START ==================
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
