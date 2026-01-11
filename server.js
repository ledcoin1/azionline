require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ===== MONGO =====
mongoose.connect(process.env.MONGO_URI)
  .then(()=>console.log("✅ MongoDB connected!"))
  .catch(e=>console.log("❌ Mongo error", e));

// ===== MODEL =====
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, unique: true },
  balance: { type: Number, default: 0 }
});
const User = mongoose.model("User", UserSchema);

// ===== LOGIN =====
app.post("/api/login", async(req,res)=>{
  try{
    const { telegramId } = req.body;
    if(!telegramId) return res.json({ error: "No telegram id" });

    let user = await User.findOne({ telegramId });
    if(!user){
      user = await User.create({ telegramId, balance: 0 });
    }

    res.json({ telegramId: user.telegramId, balance: user.balance });
  }catch(err){
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== ADMIN =====
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "admin123";
app.get("/api/admin/users", async(req,res)=>{
  const token = req.headers.authorization?.trim();
  if(token !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });

  const users = await User.find().sort({ telegramId: 1 });
  res.json(users);
});
app.post("/api/admin/balance", async(req,res)=>{
  const token = req.headers.authorization?.trim();
  if(token !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });

  const { telegramId, balance } = req.body;
  await User.updateOne({ telegramId }, { $set: { balance } });
  res.json({ success: true });
});

const lobby = {};
const rooms = {};

// ==========================
// 🔹 Сұрақ жіберу + ready/waiting + карталарды тарату
// ==========================
function sendBetRequest(roomId) {
  const room = rooms[roomId];
  if(!room) return;

  console.log(`💰 Bet request sent to room: ${roomId}`);

  // Таймер басталғанға дейін барлық ойыншылар "waiting"
  room.players.forEach(p => {
    if(p.status !== "waiting") return;
    const sId = lobby[p.id]?.socketId;
    if(!sId) return;

    io.to(sId).emit("betRequest", { roomId, bet: 500, timer: 5 });
  });

  // ==========================
  // Client жауап handler (бір рет тіркеледі)
  // ==========================
  const playerResponseHandler = (data) => {
    const { telegramId, response } = data;
    const player = room.players.find(p => p.id === telegramId);
    if(!player) return;

    player.status = response === "accepted" ? "ready" : "waiting";
    console.log(`✅ ${telegramId} жауап берді: ${player.status}`);
  };

  room.players.forEach(p => {
    const sId = lobby[p.id]?.socketId;
    if(!sId) return;
    const socket = io.sockets.sockets.get(sId);

    if(socket && !socket._playerResponseRegistered) {
      socket.on("playerResponse", playerResponseHandler);
      socket._playerResponseRegistered = true;
    }
  });

  // ==========================
  // 5 секунд таймер
  // ==========================
  setTimeout(() => {
    console.log(`⏱ 5 секунд өтті, кім ready, кім waiting:`);
    room.players.forEach(p => console.log(`${p.id}: ${p.status}`));

    // Ready ойыншыларға карталарды тарату
    dealCardsToRoom(room);

    // Таймер аяқталған соң handler өшіру
    room.players.forEach(p => {
      const sId = lobby[p.id]?.socketId;
      if(!sId) return;
      const socket = io.sockets.sockets.get(sId);
      if(socket){
        socket.off("playerResponse", playerResponseHandler);
        socket._playerResponseRegistered = false;
      }
    });

  }, 5000);
}

// ==========================
// 🔹 Ready ойыншыларға карталарды тарату функциясы
// ==========================
function dealCardsToRoom(room) {
  let deck = [];
  for(let i = 1; i <= 36; i++) deck.push(i);

  // Shuffle
  for(let i = deck.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const readyPlayers = room.players.filter(p => p.status === "ready");

  // Ready ойыншыларға 3 карта тарату
  readyPlayers.forEach(p => {
    const playerCards = deck.splice(0, 3);
    const sId = lobby[p.id]?.socketId;
    if(!sId) return;
    io.to(sId).emit("dealCards", { roomId: room.roomId, cards: playerCards });
  });

  // Ортаға 1 карта
  const middleCard = deck.splice(0, 1)[0];
  io.to(room.roomId).emit("middleCard", { card: middleCard });

  console.log("🎴 Ready ойыншыларға карталар таратылды, ортаға карта шықты:", middleCard);
}

// ==========================
// SOCKET.IO CONNECTION
// ==========================
io.on("connection", (socket) => {
  const telegramId = socket.handshake.auth.telegramId;
  if(!telegramId){
    socket.disconnect();
    return;
  }

  User.findOne({ telegramId }).then(user => {
    if(!user) return socket.disconnect();

    lobby[telegramId] = { telegramId, socketId: socket.id };
    socket.emit("balance", user.balance);
    console.log("🟢 Lobby:", Object.keys(lobby));

    // ==========================
    // Room join / create logic
    // ==========================
    let roomToJoin = null;
    for(const roomId in rooms){
      const room = rooms[roomId];
      if(room.players.length < room.maxPlayers){
        roomToJoin = room;
        break;
      }
    }

    if(roomToJoin){
      roomToJoin.players.push({ id: telegramId, status: "waiting" });
      console.log(`🟢 ${telegramId} joined existing room ${roomToJoin.roomId}`);
      sendBetRequest(roomToJoin.roomId);

      // Барлық room ойыншыларына хабарлау
      roomToJoin.players.forEach(id => {
        const sId = lobby[id]?.socketId || io.sockets.sockets.get(id);
        if(sId) io.to(sId).emit("joinedRoom", { roomId: roomToJoin.roomId, players: roomToJoin.players });
      });

      delete lobby[telegramId];

    } else {
      const lobbyPlayers = Object.keys(lobby);
      if(lobbyPlayers.length >= 2){
        const playersForRoom = lobbyPlayers.slice(0, 5);
        const roomId = "room-" + Date.now();

        rooms[roomId] = {
          roomId,
          maxPlayers: 5,
          players: playersForRoom.map(id => ({ id, status: "waiting" }))
        };

        console.log("🟢 New room created:", roomId, rooms[roomId].players);
        sendBetRequest(roomId);

        playersForRoom.forEach(id => delete lobby[id]);
        playersForRoom.forEach(id => {
          const sId = lobby[id]?.socketId || io.sockets.sockets.get(id);
          if(sId) io.to(sId).emit("joinedRoom", { roomId, players: playersForRoom });
        });
      }
    }
  });

  // ==========================
  // Disconnect
  // ==========================
  socket.on("disconnect", () => {
    delete lobby[telegramId];

    for(const roomId in rooms){
      const room = rooms[roomId];
      const idx = room.players.indexOf(telegramId);
      if(idx !== -1){
        room.players.splice(idx,1);
        room.players.forEach(id => {
          const sId = lobby[id]?.socketId || io.sockets.sockets.get(id);
          if(sId) io.to(sId).emit("joinedRoom", { roomId, players: room.players });
        });
        if(room.players.length === 0){
          delete rooms[roomId];
          console.log(`❌ Room ${roomId} deleted (empty)`);
        }
      }
    }

    console.log("❌ Disconnect:", telegramId);
  });
});

// ==========================
// SERVER START
// ==========================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log("🚀 Server running on port", PORT));
