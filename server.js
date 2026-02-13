const cors = require("cors");
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: { origin: "*", methods: ["GET","POST"] }
});

// iframe рұқсат
app.use(cors());
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  next();
});

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

mongoose.connect(process.env.MONGO_URI)
  .then(()=>console.log("✅ MongoDB connected!"))
  .catch(e=>console.log("❌ Mongo error", e));

// ===== MODEL =====
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, unique: true },
  balance: { type: Number, default: 0 }
});
const User = mongoose.model("User", UserSchema);

// ===== LOGIN =====
app.post("/api/login", async(req,res)=>{
  try{
    const { telegramId } = req.body;
    if(!telegramId) return res.json({ error: "No telegram id" });

    let user = await User.findOne({ telegramId });
    if(!user){
      user = await User.create({ telegramId, balance: 0 });
    }

    res.json({ telegramId: user.telegramId, balance: user.balance });
  }catch(err){
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== ADMIN =====
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "admin123";
app.get("/api/admin/users", async(req,res)=>{
  const token = req.headers.authorization?.trim();
  if(token !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });

  const users = await User.find().sort({ telegramId: 1 });
  res.json(users);
});
app.post("/api/admin/balance", async(req,res)=>{
  const token = req.headers.authorization?.trim();
  if(token !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });

  const { telegramId, balance } = req.body;
  await User.updateOne({ telegramId }, { $set: { balance } });
  res.json({ success: true });
});

let rooms = {};       // Room объектілері
let waiting = [];     // Play басқан ойыншыларды сақтаймыз

io.on("connection", (socket) => {
  console.log("Адам кірді:", socket.id);

  socket.on("play", async (data) => {
    const telegramId = data.telegramId;

    try {
      const user = await User.findOne({ telegramId });
      if (!user) {
        console.log("User табылмады:", telegramId);
        return;
      }

      // Бөлмеге бұрыннан қосылған ба?
      const alreadyPlaying = waiting.find(p => p.telegramId === telegramId);
      if (alreadyPlaying) {
        console.log("Ойыншы бұрыннан waiting-де:", telegramId);
        return;
      }

      // Ойыншыны waiting-ке қосу
      waiting.push({ socketId: socket.id, telegramId });
      console.log("Waiting-де жаңа ойыншы қосылды:", telegramId);
      console.log("Waiting саны:", waiting.length);

      // Егер екі ойыншы болса → room жасаймыз
      if (waiting.length >= 2) {
        const player1 = waiting.shift();
        const player2 = waiting.shift();

        const roomId = "room_" + Date.now();
        rooms[roomId] = {
          players: [player1, player2],
        };

        console.log("🔥 Room жасалды:", roomId);
        console.log("Ойыншылар:", player1.telegramId, "және", player2.telegramId);
      }

    } catch (err) {
      console.log("Mongo error:", err);
    }
  });

});


// Серверді тыңдаймыз
http.listen(PORT, () => {
  console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});


















