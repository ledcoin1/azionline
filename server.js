const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Socket қосылғанда
io.on("connection", (socket) => {
  console.log("🔌 Клиент қосылды:", socket.id);

  socket.on("join", () => {
    console.log("👉 JOIN сигналы келді:", socket.id);
  });
});

// Render PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Server ONLINE:", PORT);
});
