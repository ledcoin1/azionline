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

  // playerJoined тыңдағышы
  socket.on("playerJoined", player => {
    const roomId = "room_1";

    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = [];
    
    const playerData = {
      socketId: socket.id,
      ...player,
      status: "waiting"
    };

    rooms[roomId].push(playerData);

    console.log(`"${roomId}" бөлмесіне кірді:`, player.name);
    console.log("Room ішіндегілер:", rooms[roomId]);

    // Жаңа қосылғанға толық тізімді жіберу
    io.to(socket.id).emit("roomData", rooms[roomId]);

    // Басқа ойыншыларға хабар
    socket.to(roomId).emit("playerJoinedRoom", player);
  });

  // disconnect тыңдағышы да осы жерде
  socket.on("disconnect", () => {
    console.log("Ойыншы disconnect:", socket.id);
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(p => p.socketId !== socket.id);
      if (rooms[roomId].length === 0) delete rooms[roomId];
    }
  });

}); // <-- io.on("connection") жабылды


http.listen(PORT, () => {
  console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});






