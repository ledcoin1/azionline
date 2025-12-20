const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {};

io.on("connection", socket => {
  socket.on("joinRoom", ({ roomId, userId }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { players: [] };
    }

    if (!rooms[roomId].players.includes(userId)) {
      rooms[roomId].players.push(userId);
    }

    io.to(roomId).emit("roomUpdate", rooms[roomId].players);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
