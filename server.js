const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

// ===== DATABASE =====
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected!"))
.catch(err => console.error("🔴 MongoDB connection error:", err));

// ===== USER SCHEMA =====
const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 }
});

const User = mongoose.model("User", userSchema);

// ===== SOCKET.IO =====
io.on("connection", socket => {
  console.log("🟢 User connected:", socket.id);

  socket.on("login", async telegramId => {
    let user = await User.findOne({ telegramId });
    if (!user) {
      user = new User({ telegramId });
      await user.save();
    }
    socket.emit("user_data", user);
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// ===== ADMIN API =====
app.get("/api/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

app.post("/api/users/:id/balance", async (req, res) => {
  const { balance } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { balance }, { new: true });
  res.json(user);
});

// ===== SERVER =====
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
