// ================= IMPORTS =================
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
require("dotenv").config();

// ================= APP =================
const app = express();
const server = http.createServer(app);

app.use(express.json()); // body оқу үшін

// ================= DB CONNECT =================
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ MongoDB connected!"))
.catch(err => console.log("❌ Mongo error:", err));

// ================= SCHEMA =================
const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model("User", userSchema);

// ================= TELEGRAM LOGIN =================
// ойыншы кіргенде осы API шақырылады
app.post("/api/login", async (req, res) => {
  try {
    const { telegramId } = req.body;

    if (!telegramId) {
      return res.status(400).json({ error: "telegramId жоқ" });
    }

    let user = await User.findOne({ telegramId });

    // егер бірінші рет кірсе
    if (!user) {
      user = new User({ telegramId });
      await user.save();
      console.log("🆕 Жаңа ойыншы:", telegramId);
    }

    // бар болса – сол баланспен қайтарады
    res.json(user);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= ADMIN API =================

// барлық ойыншылар
app.get("/api/admin/users", async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
});

// баланс өзгерту
app.post("/api/admin/balance", async (req, res) => {
  try {
    const { telegramId, balance } = req.body;

    const user = await User.findOneAndUpdate(
      { telegramId },
      { balance },
      { new: true }
    );

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
