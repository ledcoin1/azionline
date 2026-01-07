// ================== IMPORTS ==================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");

// ================== APP / SERVER ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ================== MIDDLEWARE ==================
app.use(bodyParser.json()); // POST JSON үшін
app.use(express.static("public")); // фронтенд файлы үшін

// ================== MONGO DB ==================
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected!"))
.catch((err) => console.error("🔴 MongoDB connection error:", err));

// ================== MONGOOSE MODELS ==================
const userSchema = new mongoose.Schema({
  telegramId: { type: String, unique: true },
  balance: { type: Number, default: 0 },
});

const User = mongoose.model("User", userSchema);

// ================== SOCKET.IO ==================
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Telegram арқылы тіркелген қолданушыны қосу
  socket.on("telegramAuth", async ({ telegramId }) => {
    try {
      let user = await User.findOne({ telegramId });
      if (!user) {
        user = await User.create({ telegramId, balance: 0 });
      }
      socket.emit("authSuccess", user);
    } catch (err) {
      console.error(err);
      socket.emit("authError", "Сервер қатесі");
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// ================== ADMIN API ==================

// 1️⃣ Барлық қолданушылар (admin панельге)
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Сервер қатесі" });
  }
});

// 2️⃣ Баланс қосу/жаңарту
app.post("/api/users/update", async (req, res) => {
  const { telegramId, amount } = req.body;

  try {
    const user = await User.findOne({ telegramId });
    if (!user) return res.status(404).json({ error: "Қолданушы табылмады" });

    user.balance += Number(amount);
    await user.save();

    res.json(user); // жаңартылған қолданушы
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Сервер қатесі" });
  }
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
