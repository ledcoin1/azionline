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
    // player = { name, telegramId }
    console.log(`Ойыншы қосылды: ${player.name} (Telegram ID: ${player.telegramId})`);

   const roomId = "room_1"; // мысалы бір бөлме
    if (!rooms[roomId]) rooms[roomId] = [];

    rooms[roomId].push(player);

    // Бөлмедегі барлық ойыншыларды көрсету
    console.log(`Бөлме "${roomId}" ойыншылары:`, rooms[roomId]);
  });
   });
http.listen(PORT, () => {
  console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});



