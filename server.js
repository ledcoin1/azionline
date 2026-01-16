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
    const roomId = "room_1"; // әзірге бір бөлме

    // Socket.IO room-ға кіргізу
    socket.join(roomId);

    // Серверлік тізім
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({
      socketId: socket.id,
      ...player
    });

    console.log(`"${roomId}" бөлмесіне кірді:`, player.name);
    console.log("Room ішіндегілер:", rooms[roomId]);

     // 1️⃣ жаңа қосылған ойыншыға бар тізімді жіберу
    io.to(socket.id).emit("roomData", rooms[roomId]);

    // 2️⃣ басқа ойыншыларға жаңа ойыншы қосылды деп хабарлау
    socket.to(roomId).emit("playerJoinedRoom", player);
  });
    
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(
        p => p.socketId !== socket.id
      );

      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});






