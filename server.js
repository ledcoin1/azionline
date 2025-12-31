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
const komta = {};

const waitingPlayers = []; //кезекте тұру ойыншылардың

function createKomta() {
  const komtaId = "komta-" + Date.now();

  komta[komtaId] = {
    id: komtaId,
    igroktar: [],

    status: "waiting",   // waiting / playing / canceled

    kaloda: [],
    kozir: null,
    kezek: null,

    betAmount: 500,

    bank: 0,             // 💰 КОМТА БАНКІ (осы раундқа)
    totalPot: 0,         // визуал / статистика үшін

    playerBets: {},      // кім қанша қойды
    betResponses: {},    // готов / отбой
    skipPlayers: []      // отбой басқандар
  };

  return komta[komtaId];
}

io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id); // Клиент серверге қосылғанын логқа шығарамыз

  // күту тізіміне қосамыз
  waitingPlayers.push(socket); // Жаңа қосылған ойыншыны кезекте сақтаймыз

  // Disconnect болғанда
  socket.on("disconnect", () => {
    const index = waitingPlayers.indexOf(socket); // Ойыншының индексін іздейміз
    if (index !== -1) waitingPlayers.splice(index, 1); // Егер табылса, кезектен шығарамыз
    console.log("DISCONNECTED:", socket.id); // Логта көрсетеміз
  });

  // егер 3 ойыншы жиналса → комта жасаймыз
  if (waitingPlayers.length === 3) {
    const room = createKomta(); // Жаңа комта жасаймыз
    room.kaloda = generateDeck(); // generateDeck() функциясымен
    // карталарды араластыру (shuffle)
  room.kaloda = shuffle(room.kaloda);

    room.skipPlayers = []; // "отбой" басқан ойыншылардың тізімі


    waitingPlayers.forEach((playerSocket) => {
  playerSocket.join(room.id);

  
      room.igroktar.push({
    socketId: playerSocket.id,
    balance: 2000 // 👈 міндетті
  });


      

      
      
      
      room.betResponses[playerSocket.id] = null; // әлі жауап жоқ деп белгілейміз
      playerSocket.emit("askBet", { betAmount: room.betAmount }); 
      // Клиентке хабар: 500 ставканы қабылдайсың ба?
       
      // клиентке қосылған комта туралы хабарлау
      playerSocket.emit("joinedRoom", {
        roomId: room.id, // комта идентификаторы
        players: room.igroktar.map(p => p.socketId), // кімдер бар екенін хабарлаймыз
        totalPot: room.totalPot // жалпы ставканы хабарлаймыз
      });
    });

    console.log("КОМТА ҚҰРЫЛДЫ:", room.id, "TOTAL POT:", room.totalPot); // Сервер логында көрсету

    // кезекті тазалаймыз
    waitingPlayers.length = 0; // келесі ойыншылар үшін кезекті босатамыз

    // =============================================
   // =============================================
socket.on("betResponse", (data) => {
  const { socketId, response } = data;

  // ойыншы қай комтада екенін табамыз
  const room = Object.values(komta).find(r =>
    r.igroktar.some(p => p.socketId === socketId)
  );
  if (!room) return;

  const player = room.igroktar.find(p => p.socketId === socketId);
  if (!player) return;

  room.betResponses[socketId] = response;

  // =========================
  // ОТБОЙ
  // =========================
  if (response === "отбой") {
    if (!room.skipPlayers.includes(socketId)) {
      room.skipPlayers.push(socketId);
    }
    console.log(`РАУНДҚА ҚАТЫСПАЙТЫН ОЙЫНШЫ: ${socketId}`);
    return;
  }

  // =========================
  // ГОТОВ
  // =========================
  if (response === "готов") {
    // 1️⃣ Баланс тексеру
    if (player.balance < room.betAmount) {
      io.to(socketId).emit("notEnoughBalance", {
        required: room.betAmount,
        balance: player.balance
      });
      room.skipPlayers.push(socketId);
      room.betResponses[socketId] = "отбой";
      return;
    }

    // 2️⃣ Баланс азайту + банкке қосу
    player.balance -= room.betAmount;
    room.bank += room.betAmount;

    // 3️⃣ Ставканы тіркеу
    room.playerBets[socketId] = room.betAmount;
    room.totalPot = room.bank;

    console.log(`💸 ${socketId} банкке ${room.betAmount} салды`);
  }

  // =========================
  // БАРЛЫҚ ЖАУАПТАР КЕЛДІ МЕ?
  // =========================
  const responses = Object.values(room.betResponses);
  if (
    responses.length === room.igroktar.length &&
    responses.every(r => r === "готов" || r === "отбой")
  ) {
    // 4️⃣ Раунд басталады
    room.status = "playing";

    // Раундқа қатысатын ойыншылар
    const activePlayers = room.igroktar.filter(
      p => !room.skipPlayers.includes(p.socketId)
    );

    // 5️⃣ Әр ойыншыға 3 карта тарату
    activePlayers.forEach(player => {
      player.hand = room.kaloda.splice(0, 3);
    });

    // 6️⃣ Козырь таңдау
    room.kozir = room.kaloda.pop();

    // 7️⃣ Лог
    console.log("РАУНД БАСТАЛДЫ!", room.id);
    console.log(
      "Раундқа қатысатын ойыншылар:",
      activePlayers.map(p => p.socketId)
    );
    console.log(
      "Раундқа тараған карталар:",
      activePlayers.map(p => ({ id: p.socketId, hand: p.hand }))
    );
    console.log("Козырь:", room.kozir);
    console.log("РАУНД БАНКІ:", room.bank);
  }
});
 }
});



// --- Колода генерациясы ---
function generateDeck() {
  const suits = ["♥", "♦", "♣", "♠"]; // символдармен
  const ranks = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const deck = [];

  suits.forEach(suit => {
    ranks.forEach(rank => {
      deck.push({ suit, rank });
    });
  });

  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
