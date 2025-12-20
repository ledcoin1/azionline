const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const suits = ["♠", "♥", "♦", "♣"];
const values = [6,7,8,9,10,11,12,13,14];

function shuffle(deck) {
  for (let i = deck.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function createDeck() {
  const deck = [];
  for (let s of suits) {
    for (let v of values) deck.push({ suit:s, value:v });
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

let waiting = null;
let rooms = {}; // roomId => {players, hands, turn, table, trump, tricks}

io.on("connection", socket => {

  socket.on("joinGame", ({ userId }) => {

    if (!waiting) {
      waiting = { socket, userId };
      socket.emit("message", "Сіз бірінші ойыншы, қарсылас күтілуде...");
    } else {
      const other = waiting;
      waiting = null;

      const deck = createDeck();
      const trump = deck.pop().suit;

      const roomId = "room_" + Date.now();
      rooms[roomId] = {
        players: [other.userId, userId],
        hands: {
          [other.userId]: deck.splice(0,3),
          [userId]: deck.splice(0,3)
        },
        turn: other.userId,
        table: [],
        trump,
        tricks: {[other.userId]:0, [userId]:0},
        sockets: {
          [other.userId]: other.socket,
          [userId]: socket
        }
      };

      // Екі ойыншыға хабар
      other.socket.emit("startGame", { opponentId: userId, roomId, trump });
      socket.emit("startGame", { opponentId: other.userId, roomId, trump });
    }
  });

  socket.on("playCard", ({ roomId, userId, cardIndex }) => {
    const room = rooms[roomId];
    if (!room || room.turn !== userId) return;

    const hand = room.hands[userId];
    const card = hand.splice(cardIndex,1)[0];
    room.table.push({ userId, card });

    // Бірінші жүріс
    if (room.table.length === 1) {
      const other = room.players.find(p=>p!==userId);
      room.turn = other;
      updateClients(room);
      return;
    }

    // Екінші карта
    if (room.table.length === 2) {
      const [a,b] = room.table;
      const leadSuit = a.card.suit;
      let winner = beats(a.card,b.card,room.trump,leadSuit)?a.userId:b.userId;
      room.tricks[winner]++;
      room.turn = winner;
      room.table = [];
      updateClients(room);

      // Ойын аяқталды ма?
      if (room.players.every(p => room.hands[p].length===0)) {
        room.players.forEach(p=>{
          room.sockets[p].emit("gameEnd", room.tricks);
        });
        delete rooms[roomId];
      }
    }
  });

  function updateClients(room){
    room.players.forEach(p=>{
      const hand = room.hands[p];
      const opponent = room.players.find(x=>x!==p);
      room.sockets[p].emit("update", {
        hand,
        table: room.table,
        turn: room.turn,
        opponent: opponent,
        trump: room.trump
      });
    });
  }

});
server.listen(3000,()=>console.log("Server running on 3000"));
