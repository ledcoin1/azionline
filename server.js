// ================== IMPORTS ==================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
require("dotenv").config(); // .env файлын оқиды

// ================== APP / SERVER ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// ================== PORT ==================
const PORT = process.env.PORT || 3000;

// ================== MONGODB ==================
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("🟢 MongoDB connected"))
  .catch(err => console.error("🔴 MongoDB connection error:", err));

// ================== PLAYER SCHEMA ==================
const playerSchema = new mongoose.Schema({
  telegramId: { type: String, unique: true }, // Telegram ID болашақта қажет
  username: String,
  firstName: String,
  balance: { type: Number, default: 0 }, // Әр ойыншының балансы
  createdAt: { type: Date, default: Date.now }
});

const Player = mongoose.model("Player", playerSchema);

// ================== SOCKET.IO ==================
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Telegram арқылы auth немесе тест үшін қолмен жіберуге болады
  socket.on("telegram_auth", async (user) => {
    /*
      user = {
        id,         // Telegram ID
        username,
        first_name
      }
    */

    try {
      let player = await Player.findOne({ telegramId: user.id });

      if (!player) {
        // 🆕 Жаңа ойыншы жасау
        player = await Player.create({
          telegramId: user.id,
          username: user.username,
          firstName: user.first_name,
          balance: 0
        });
        console.log("🆕 New player created:", user.id);
      } else {
        console.log("♻ Existing player:", user.id);
      }

      // Socket-ке player мәліметін жіберу
      socket.playerId = player._id;
      socket.emit("player_data", {
        id: player._id,
        balance: player.balance,
        username: player.username
      });

    } catch (err) {
      console.error("🔴 Error handling player:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// ================== START SERVER ==================
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
