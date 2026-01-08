require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
app.use(express.json());

// ===== STATIC FRONTEND =====
app.use(express.static("public"));

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

// ===== ADMIN TOKEN =====
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// ===== MIDDLEWARE =====
function checkAdmin(req, res, next) {
  const token = req.headers["authorization"] || "";
  if (token.trim() !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ===== LOGIN (TELEGRAM FRONTEND) =====
app.post("/api/login", async (req, res) => {
  try {
    const { telegramId } = req.body;
    if (!telegramId) return res.json({ error: "No telegramId" });

    let user = await User.findOne({ telegramId });
    if (!user) {
      user = await User.create({ telegramId, balance: 0 });
    }

    res.json({ telegramId: user.telegramId, balance: user.balance });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ===== ADMIN ROUTES =====
app.get("/api/admin/users", checkAdmin, async (req, res) => {
  const users = await User.find().sort({ telegramId: 1 });
  res.json(users);
});

app.post("/api/admin/balance", checkAdmin, async (req, res) => {
  const { telegramId, balance } = req.body;
  await User.updateOne({ telegramId }, { $set: { balance } });
  res.json({ success: true });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log("🚀 Server running on port", PORT));
