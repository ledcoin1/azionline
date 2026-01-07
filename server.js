// ================== IMPORTS ==================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
require("dotenv").config();

// ================== APP / SERVER ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ================== MIDDLEWARE ==================
app.use(express.json());
app.use(express.static("public")); // фронтенд үшін

// ================== DATABASE ==================
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected!"))
.catch((err) => console.error("🔴 MongoDB connection error:", err));

// ================== SCHEMAS ==================
const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
});

const User = mongoose.model("User", userSchema);

// ================== SOCKET.IO ==================
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Телеграм ID арқылы кірген қолданушыны тіркеу / алу
  socket.on("login", async (telegramId) => {
    try {
      let user = await User.findOne({ telegramId });
      if (!user) {
        user = new User({ telegramId, balance: 0 });
        await user.save();
      }
      socket.emit("user_data", user);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// ================== API (админ панельге) ==================
app.get("/api/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

app.post("/api/users/:id/balance", async (req, res) => {
  const { id } = req.params;
  const { balance } = req.body;
  const user = await User.findByIdAndUpdate(id, { balance }, { new: true });
  res.json(user);
});

// ================== SERVER ==================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
