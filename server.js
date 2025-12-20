// Қажетті кітапханаларды шақырамыз
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// Серверді жасаймыз
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Клиентке статикалық файлдарды береміз
app.use(express.static("public"));

// Клиент қосылғанда орындалатын код
io.on("connection", (socket) => {
  console.log("Клиент қосылды");

  // Клиенттен хабар келгенде орындалады
  socket.on("joinGame", ({ userId }) => {
    console.log("Ойынға қосылды:", userId);

    // Сервер хабарын клиентке қайта жіберу
    socket.emit("message", `Сәлем, ойыншы ${userId}! Сіз серверге қосылдыңыз.`);
  });
});

// Серверді 3000 портында іске қосамыз
server.listen(3000, () => console.log("Server running on http://localhost:3000"));


