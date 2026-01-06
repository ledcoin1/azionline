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

// ================== PLAYERS STORAGE ==================
const players = {}; 
// { socketId: { id, username, first_name } }

// ================== SOCKET.IO ==================
io.on("connection", (socket) => {
  console.log("🔌 Қосылды:", socket.id);

  // Telegram-нан келген ойыншы деректерін қабылдаймыз
  socket.on("telegram_user", (user) => {
    players[socket.id] = {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
    };

    console.log("👤 Ойыншы кірді:", players[socket.id]);

    // клиентке растау жібереміз
    socket.emit("login_success", players[socket.id]);
  });

  socket.on("disconnect", () => {
    console.log("❌ Шықты:", socket.id);
    delete players[socket.id];
  });
});

// ================== START SERVER ==================
const PORT = 3000;
server.listen(PORT, () => {
  console.log("🚀 Сервер іске қосылды: http://localhost:" + PORT);
});
