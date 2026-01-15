const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: { origin: "*", methods: ["GET","POST"] }
});

// iframe рұқсат
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  next();
});

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

let players = {};
let lobby = [];
let rooms = {};

io.on("connection", socket => {
  console.log("Жаңа ойыншы қосылды:", socket.id);

  socket.on("playerJoined", player => {
    players[socket.id] = player;
    lobby.push({ socketId: socket.id, player });

    if(lobby.length >= 2){
      const roomId = `room_${Date.now()}`;
      const p1 = lobby.shift();
      const p2 = lobby.shift();

      rooms[roomId] = [p1, p2];

      io.to(p1.socketId).emit("roomCreated", { roomId, players: rooms[roomId] });
      io.to(p2.socketId).emit("roomCreated", { roomId, players: rooms[roomId] });
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    lobby = lobby.filter(p => p.socketId !== socket.id);

    for(const roomId in rooms){
      rooms[roomId] = rooms[roomId].filter(p => p.socketId !== socket.id);
      if(rooms[roomId].length === 0) delete rooms[roomId];
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});
