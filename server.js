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

// ================== STORAGE ==================
const lobby = {};   // ойынды күтетіндер
const rooms = {};   // (кейін) ойын ішіндегілер

// ================== SOCKET.IO ==================
io.on("connection", (socket) => {
  console.log("🔌 Қосылды:", socket.id);

  // Telegram арқылы кірген ойыншы
  socket.on("telegram_user", (user) => {
    lobby[socket.id] = {
      socketId: socket.id,
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      status: "lobby",
    };

    console.log("🟢 Lobby-ге кірді:", lobby[socket.id]);

    socket.emit("login_success", lobby[socket.id]);
  });

  // Ойыншы шықса
  socket.on("disconnect", () => {
    console.log("❌ Шықты:", socket.id);
    delete lobby[socket.id];
  });
});

// ================== START SERVER ==================
const PORT = 3000;
server.listen(PORT, () => {
  console.log("🚀 Сервер іске қосылды: http://localhost:" + PORT);
});
