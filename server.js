const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let waiting = null;

io.on("connection", socket => {
  console.log("Клиент қосылды");

  socket.on("joinGame", ({ userId }) => {
    if (!waiting) {
      waiting = { socket, userId };
      socket.emit("message", "Сіз бірінші ойыншы, қарсылас күтілуде...");
    } else {
      const other = waiting;
      waiting = null;

      // Қарсылас табылды → екі жаққа хабар жіберу
      socket.emit("startGame", { opponentId: other.userId });
      other.socket.emit("startGame", { opponentId: userId });
    }
  });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
