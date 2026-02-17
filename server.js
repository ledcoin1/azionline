const cors = require("cors");
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const { Socket } = require("socket.io");
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


function createDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const values = ["6","7","8","9","10","J","Q","K","A"];

  let deck = [];

  for (let suit of suits) {
    for (let value of values) {
      deck.push(value + suit);
    }
  }

  return deck;
}

function shuffle(deck) {
  return deck.sort(() => Math.random() - 0.5);
}


function startGame() {

  let deck = createDeck();
  deck = shuffle(deck);

  // 3 картадан бөлеміз
  let player1Cards = deck.splice(0, 3);
  let player2Cards = deck.splice(0, 3);

  // Әр ойыншыға тек өз картасын жібереміз
  io.to(komta.player1.socketId).emit("cards", player1Cards);
  io.to(komta.player2.socketId).emit("cards", player2Cards);

}





let  kirgen = [];
let komta={};


io.on("connection", (socket) => {

  socket.on("play", (data) => {

    if (!kirgen.includes(data.telegramId)) {
      kirgen.push(data.telegramId);
    }

    console.log("Қазір массив:", kirgen);

    // 👇 ДӘЛ ОСЫ ЖЕРГЕ жазылады
    if (kirgen.length === 2) {

      komta.player1 = kirgen[0];
      komta.player2 = kirgen[1];

        io.to(komta.player1.socketId).emit("bastaldy");
    io.to(komta.player2.socketId).emit("bastaldy");

    startGame();
      kirgen = [];
    }
  });

   


  socket.on("disconnect",()=>{
    console.log("ойыншы шығып кетті");
  });

});

// Серверді тыңдаймыз
http.listen(PORT, () => {
  console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});












