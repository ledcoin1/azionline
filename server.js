console.log("🚀 MONGO_URI =", process.env.MONGO_URI);

// ================== IMPORTS ==================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
require('dotenv').config();

// ================== APP / SERVER ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

// ================== MONGODB ==================
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("🟢 MongoDB connected"))
.catch(err => console.log("🔴 MongoDB connection error:", err));

// ================== SCHEMAS ==================
const playerSchema = new mongoose.Schema({
  telegramId: String,
  balance: { type: Number, default: 0 },
});

const Player = mongoose.model("Player", playerSchema);

// ================== STATIC FILE ==================
app.use(express.static("public"));

// ================== SOCKET.IO ==================
io.on("connection", socket => {
  console.log("🟢 User connected:", socket.id);

  socket.on("register_player", async telegramId => {
    let player = await Player.findOne({ telegramId });
    if (!player) {
      player = await Player.create({ telegramId, balance: 0 });
    }
    socket.emit("player_data", player);
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// ================== START SERVER ==================
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

