// ================== IMPORTS ==================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

// ================== APP / SERVER ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // Vercel немесе басқа фронтендке рұқсат
});

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // телеграм клиент файлы

const PORT = process.env.PORT || 10000;

// ================== MONGO ==================
console.log("🚀 MONGO_URI =", process.env.MONGO_URI);
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected!"))
.catch(err => console.log("🔴 MongoDB connection error:", err));

// ================== SCHEMAS ==================
const userSchema = new mongoose.Schema({
  telegramId: { type: String, unique: true },
  balance: { type: Number, default: 0 }
});

const User = mongoose.model("User", userSchema);

// ================== SOCKET.IO ==================
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("login", async ({ telegramId }) => {
    if(!telegramId) return;

    let user = await User.findOne({ telegramId });
    if(!user) {
      user = await User.create({ telegramId, balance: 0 });
      console.log("➕ New user created:", telegramId);
    }

    socket.emit("loginSuccess", { telegramId: user.telegramId, balance: user.balance });
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// ================== ADMIN API ==================

// Get all users
app.get("/api/users", async (req, res) => {
  const users = await User.find({}, "-_id telegramId balance").lean();
  res.json(users);
});

// Add balance to a user
app.post("/api/users/:telegramId/add", async (req, res) => {
  const { telegramId } = req.params;
  const { amount } = req.body;

  if(!amount || amount <= 0) return res.status(400).json({error: "Invalid amount"});

  const user = await User.findOne({ telegramId });
  if(!user) return res.status(404).json({error: "User not found"});

  user.balance += amount;
  await user.save();

  res.json({telegramId: user.telegramId, balance: user.balance});
});

// ================== START SERVER ==================
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
