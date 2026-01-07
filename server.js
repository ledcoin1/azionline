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

app.use(bodyParser.json()); // Админ API үшін JSON қолдау
app.use(express.static("public")); // Frontend files

// ================== ENV ==================
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 10000;

// ================== MONGODB ==================
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected!"))
  .catch(err => console.error("🔴 MongoDB connection error:", err));

// ================== USER MODEL ==================
const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: { type: String },
  balance: { type: Number, default: 0 },
});

const User = mongoose.model("User", userSchema);

// ================== TELEGRAM SOCKET ==================
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Telegram арқылы кіргенде:
  // data = { telegramId, username }
  socket.on("telegram-login", async (data) => {
    if (!data || !data.telegramId) return;

    let user = await User.findOne({ telegramId: data.telegramId });
    if (!user) {
      // Егер жаңа қолданушы болса, жаса
      user = new User({
        telegramId: data.telegramId,
        username: data.username || "",
        balance: 0
      });
      await user.save();
      console.log(`✨ New user created: ${data.username} (${data.telegramId})`);
    }

    socket.emit("login-success", {
      telegramId: user.telegramId,
      username: user.username,
      balance: user.balance
    });
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// ================== ADMIN API ==================
// Баланс қосу үшін (қосымша, Vercel-ге админ панельден шақырады)
app.post("/admin/add-balance", async (req, res) => {
  const { telegramId, amount } = req.body;
  if (!telegramId || typeof amount !== "number") {
    return res.status(400).json({ error: "telegramId and amount required" });
  }

  const user = await User.findOne({ telegramId });
  if (!user) return res.status(404).json({ error: "User not found" });

  user.balance += amount;
  await user.save();

  return res.json({ success: true, balance: user.balance });
});

// ================== START SERVER ==================
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
