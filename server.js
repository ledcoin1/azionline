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

    // ---------- 3 адам жиналды ма? ----------
    if (lobby.length >= 3) {

      // Алғашқы 3 адамды аламыз
      const playersIds = lobby.splice(0, 3);

      // Уникальный room idroom
      const roomId = "room_" + Date.now();

      // ---------- ROOM ҚҰРУ ----------
      rooms[roomId] = {
        id: roomId,

        // бастапқы күй
        state: "ready",

        // 3 ойыншы
        players: playersIds.map(id => ({
          id: id,          // socket.id
          balance: 1000,   // бастапқы баланс
          status: "idle"   // әзірше ештеңе істеп тұрған жоқ
        })),

        // 1 раунд ойнаймыз ба? деген сұраққа арналған
        roundRequest: {
          active: false,   // сұрақ белсенді ме
          answers: {}      // жауаптар { socketId: true/false }
        },

         turns: [],        // бір жүрістегі тасталған 3 карта
  tricksWon: {},    // { socketId: саны }
  currentTurn: null // кімнің кезегі (рандом кейін толады)
      };

      console.log("🏠 Room created:", roomId);

      // ---------- ОЙЫНШЫЛАРДЫ ROOM-ҒА ҚОСУ ----------
      playersIds.forEach(id => {
        const playerSocket = io.sockets.sockets.get(id);
        if (playerSocket) {
          playerSocket.join(roomId);

          // Клиентке: сен осы room-ға кірдің
          playerSocket.emit("room_joined", {
            roomId,
            players: rooms[roomId].players
          });
        }
      });

      // ---------- 1 СЕКУНДТАН КЕЙІН ОЙЫН БАСТАЛАДЫ ----------
      setTimeout(() => {
        // Егер room өшіп кетсе — ештеңе істемейміз
        if (!rooms[roomId]) return;

        // Room күйін ауыстырамыз
        rooms[roomId].state = "playing";

        // Клиенттерге: ойын басталды
        io.to(roomId).emit("game_started", {
          roomId
        });

        console.log("🎮 Game started:", roomId);

        // ---------- 1 РАУНД ОЙНАЙМЫЗ БА? ----------
        rooms[roomId].roundRequest.active = true;
        rooms[roomId].roundRequest.answers = {};

        // 3 ойыншыға бірдей сұрақ жіберіледі
        io.to(roomId).emit("ask_round", {
          message: "1 раунд ойнаймыз ба?"
        });

        console.log("❓ Round request sent:", roomId);

      }, 1000);

    } else {
      // ---------- ӘЛІ 3 АДАМ ЖОҚ ----------
      socket.emit("waiting", {
        count: lobby.length,
        needed: 3
      });
    }
  });

    // ---------- ROUND ANSWER ----------
  socket.on("round_answer", (data) => {
    const { roomId, answer } = data;
    // answer: true (yes) немесе false (no)

    const room = rooms[roomId];
    if (!room) return;

    // Егер сұрақ актив емес болса — қабылдамаймыз
    if (!room.roundRequest.active) return;

    // Жауапты сақтаймыз
    room.roundRequest.answers[socket.id] = answer;

    console.log(
      `📝 Answer from ${socket.id} in ${roomId}:`,
      answer
    );

    // ---------- БАРЛЫҒЫ ЖАУАП БЕРДІ МЕ? ----------
    const totalPlayers = room.players.length;
    const totalAnswers = Object.keys(room.roundRequest.answers).length;

    if (totalAnswers === totalPlayers) {
      // Сұрақты жабамыз
      room.roundRequest.active = false;

      // ---------- YES / NO ТЕКСЕРУ ----------
      const answers = Object.values(room.roundRequest.answers);

      const allYes = answers.every(a => a === true);

      if (allYes) {
        console.log("✅ All players agreed. Round starts!");

        io.to(roomId).emit("round_started", {
          message: "Раунд басталды!"
        });

        // ---------- ROUND START: DECK ----------
const deck = createDeck();
shuffle(deck);

// room-ға сақтаймыз
room.deck = deck;

console.log("🃏 New deck created for", roomId);

// ---------- TRUMP ----------
const trump = room.deck[room.deck.length - 1];
room.trump = trump;

console.log("🂡 Trump card:", trump);

// ---------- DEAL 3 CARDS ----------
room.players.forEach(player => {
  player.hand = room.deck.splice(0, 3);
});

// ---------- SEND CARDS TO PLAYERS ----------
room.players.forEach(player => {
  io.to(player.id).emit("your_cards", {
    hand: player.hand,  // тек осы ойыншының картасы
    trump: room.trump
  });
});

console.log("🃏 Cards sent to players. Trump:", room.trump);


// ---------- RANDOM FIRST ATTACKER ----------
const randomIndex = Math.floor(Math.random() * room.players.length);
const firstPlayer = room.players[randomIndex];

// room-да сақтаймыз
room.currentTurn = firstPlayer.id;

// сол ойыншыға хабар жібереміз
io.to(firstPlayer.id).emit("your_turn", {
  message: "Сіз бірінші жүресіз"
});

console.log("⚡ First turn randomly assigned to:", firstPlayer.id);






        // ⬇️ келесі қадамда осы жерде
        // карталарды тарату / ставка / логика басталады

      } else {
        console.log("⛔ Someone declined. Game ends.");

        io.to(roomId).emit("game_ended", {
          message: "Кем дегенде бір ойыншы бас тартты"
        });

        // room-ды өшіреміз
        delete rooms[roomId];
      }
    }
  });


  // ================= PLAY CARD =================
socket.on("play_card", ({ roomId, card }) => {
  const room = rooms[roomId];
  if (!room) return;

  // Тек кезегі келген ойыншы ғана ойнай алады
  if (room.currentTurn !== socket.id) return;

  const player = room.players.find(p => p.id === socket.id);
  if (!player) return;

  // Карта қолында бар ма?
  const index = player.hand.indexOf(card);
  if (index === -1) return;

  // Қолынан карта шығару
  player.hand.splice(index, 1);

  // Жүріске қосу
  room.turns.push({
    playerId: socket.id,
    card
  });

  console.log("🃏 Card played:", socket.id, card);

  // Орталыққа барлық ойыншыларға көрсету
  io.to(roomId).emit("card_played", {
    playerId: socket.id,
    card
  });

  // ---------- 3 CARD CHECK ----------
  if (room.turns.length === 3) {
    // Жүріс жеңімпазын анықтау
    const winnerId = determineTrickWinner(room.turns, room.trump);
    console.log("🏆 Trick winner:", winnerId);

    // Ұтқан жүріс санын санау
    room.tricksWon[winnerId] = (room.tricksWon[winnerId] || 0) + 1;

    // Барлығына хабарлау
    io.to(roomId).emit("trick_winner", {
      winnerId,
      tricksWon: room.tricksWon
    });

    // Келесі жүріс — ұтқан ойыншыдан
    room.currentTurn = winnerId;

    // Жүрісті тазалау
    room.turns = [];

    // Сол ойыншыға кезек беру
    io.to(winnerId).emit("your_turn", {
      message: "Сіз жүрісті ұттыңыз, қайта жүресіз"
    });

    // ---------- CHECK GAME OVER ----------
    if (room.tricksWon[winnerId] >= 2) {
      console.log("🎉 Game over! Winner:", winnerId);
      io.to(roomId).emit("game_ended", {
        winnerId,
        message: "Ойын аяқталды! Жеңімпаз: " + winnerId
      });

      // Room-ды өшіру
      delete rooms[roomId];
    }
  } else {
    // ---------- NEXT TURN ----------
    // Келесі ойыншының кезегі (роум.players массивінде) 
    const currentIndex = room.players.findIndex(p => p.id === socket.id);
    const nextIndex = (currentIndex + 1) % room.players.length;
    const nextPlayer = room.players[nextIndex];

    room.currentTurn = nextPlayer.id;

    io.to(nextPlayer.id).emit("your_turn", {
      message: "Сіздің кезегіңіз"
    });
  }
});


  // ---------- DISCONNECT ----------
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    // lobby-ден өшіреміз
    const index = lobby.indexOf(socket.id);
    if (index !== -1) {
      lobby.splice(index, 1);
    }
  });
});

  

// ================== SERVER START ==================
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
