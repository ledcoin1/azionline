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
      socket.emit("message", "Қарсылас табылды! Ойын басталды.");
      other.socket.emit("message", "Қарсылас қосылды! Ойын басталды.");
      waiting = null;
    }
  });
});

server.listen(3000, () => console.log("Server running on port 3000"));
