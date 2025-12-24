const express = require("express"); 
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = [];
let rooms = {};

// Клиент қосылды
io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

 socket.on("join game", (playerName) => {
  // 1️⃣ Максимум 5 ойыншы бір комнатаға
  // Алдымен бос комната іздеу
  let roomId = null;
  for (const id in rooms) {
    if (rooms[id].length < 5) {
      roomId = id;
      break;
    }
  }

  // Егер бос комната жоқ → жаңа комната жасау
  if (!roomId) {
    roomId = `room-${Date.now()}`; // уникалды ID
    rooms[roomId] = [];
  }

  // 2️⃣ Ойыншыны кімнің кім екенін тексеріп қосу
  // Бір телеграм аккаунт тек бір рет қосылады
  if (!rooms[roomId].some(p => p.id === socket.id)) {
    rooms[roomId].push({ id: socket.id, name: playerName });

    socket.join(roomId); // Socket.IO room-ға қосу

    // 3️⃣ Егер 2 адам қосылған болса → комната ашылды
    if (rooms[roomId].length >= 2) {
      io.to(roomId).emit("room started", rooms[roomId]);
    }

    // 4️⃣ Барлық ойыншыларға өз комнатадағы ойыншылар тізімін жіберу
    io.to(roomId).emit("update players", rooms[roomId]);
  } else {
    socket.emit("error", "Сіз осы комнатада барсыз");
  }
});


  // Ойыншы disconnect болғанда
  socket.on("disconnect", () => {
    players = players.filter(p => p.id !== socket.id);
    io.emit("update players", players);
  });

}); // <- Мұнда io.on жабылуы керек

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server ONLINE on port", PORT));

