require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors"); // CORS үшін
const path = require("path");
const http = require("http");       // <- қосамыз
const { Server } = require("socket.io"); // <- қосамы

const app = express();
app.use(cors()); // 🟢 барлық фронтендтен қосылуға рұқсат
app.use(express.json());

// ===== STATIC FRONTEND =====
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // фронтенд кез келген жерден қосылсын
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

// ===== LOGIN (Telegram арқылы) =====
app.post("/api/login", async(req,res)=>{
  try{
    const { telegramId } = req.body;
    if(!telegramId) return res.json({ error: "No telegram id" });

    let user = await User.findOne({ telegramId });

    // Жаңа қолданушы
    if(!user){
      user = await User.create({
        telegramId,
        balance: 0
      });
    }

    res.json({
      telegramId: user.telegramId,
      balance: user.balance
    });

  }catch(err){
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== ADMIN AUTH =====
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "admin123";

// ===== GET ALL USERS =====
app.get("/api/admin/users", async(req,res)=>{
  const token = req.headers.authorization?.trim(); // 🟢 trim қосылды
  if(token !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });

  const users = await User.find().sort({ telegramId: 1 });
  res.json(users);
});

// ===== UPDATE BALANCE =====
app.post("/api/admin/balance", async(req,res)=>{
  const token = req.headers.authorization?.trim();
  if(token !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });

  const { telegramId, balance } = req.body;
  await User.updateOne({ telegramId }, { $set: { balance } });

  res.json({ success: true });
});

let lobby = [];

io.on("connection", (socket) => {
  console.log("🔌 New connection:", socket.id);

  // Ойыншы Telegram арқылы кіргенде
  socket.on("joinLobby", async (telegramId) => {
    // Лоббиде жоқ болса қосу
    if (!lobby.find(p => p.telegramId === telegramId)) {
      lobby.push({ telegramId, socketId: socket.id });
      console.log("👥 Lobby:", lobby);
    }

    // Лобби ағымдағы ойыншыларын жіберу (frontend үшін)
    io.emit("lobbyUpdate", lobby.map(p => p.telegramId));
  });

  // Disconnect болса лоббиден шығару
  socket.on("disconnect", () => {
    lobby = lobby.filter(p => p.socketId !== socket.id);
    console.log("❌ Disconnected, lobby:", lobby);
    io.emit("lobbyUpdate", lobby.map(p => p.telegramId));
  });
});



const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
