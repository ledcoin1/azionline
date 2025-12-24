const express = require("express"); 
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = [];

// Клиент қосылды
io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

  socket.on("join game", (playerName) => {
    // 1️⃣ Максимум 5 адам тексеру
    if (players.length < 5) {
      // 2️⃣ Ойыншы тізімге қосу
      players.push({ id: socket.id, name: playerName });

      // 3️⃣ Егер 1 адамнан көп болса → комната ашу логикасы
      if (players.length > 1) {
        // Комната ашылды, бәріне хабар беру
        io.emit("room started", players);
      }

      // 4️⃣ Ойыншылар тізімін барлыққа жаңарту
      io.emit("update players", players);
    } else {
      // Ойын толы болса → клиентке хабар беру
      socket.emit("error", "Ойын толы");
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
