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



// 36 карталық колода
let san = [];
const suits = ["♥", "♦", "♣", "♠"];
const values = ["6","7","8","9","10","J","Q","K","A"];

for (let suit of suits) {
  for (let value of values) {
    san.push(value + suit); // мысалы: "6♥", "J♠"
  }
}

console.log("Карталар дайын:", san.length); // 36




let komta = {

  players:[],
  card: null,
  obwiBalans: null,
  zhenis: null,
  raund: null,
  kozir: null

};


function createDeck() {
  const suits = ["♥", "♦", "♣", "♠"];
  const values = ["6","7","8","9","10","J","Q","K","A"];
  let deck = [];

  for (let suit of suits) {
    for (let value of values) {
      deck.push(value + suit);
    }
  }

  return deck;
}

io.on("connection", (socket) => {

  console.log("ойыншы кірді")


  socket.on("play",(data)=>{

    if (komta.players.length === 0) {
  san = createDeck();
}

    if(komta.players.length>=2){
      socket.emit("toly","2 adam bar");
      return;
    }
   const telegramId = data.telegramId;
   komta.players.push({
    id: socket.id,
    telegram: telegramId,
    cards: [],
    turn: null,
    status: "azirshe",
    balans: 500,
    raund: null
   });
   


 // көзір картаны таңдау
let kozirIndex = Math.floor(Math.random() * san.length);
komta.kozir = san[kozirIndex];
san.splice(kozirIndex, 1);

// әр ойыншыға 3 карта беру
for (let i = 0; i < komta.players.length; i++) {
  komta.players[i].cards = [];
  for (let j = 0; j < 3; j++) {
    let index = Math.floor(Math.random() * san.length);
    komta.players[i].cards.push(san[index]);
    san.splice(index, 1);
  }
  io.to(komta.players[i].id).emit("cards", komta.players[i].cards);
}

if (komta.players.length === 2) {
  komta.players[0].turn = true;
  komta.players[1].turn = false;

  console.log("Бірінші ойыншы жүрісті бастайды");
}

console.log("Көзір карта:", komta.kozir);
console.log("Ойыншылар:", komta.players);
console.log("Қалған карталар:", san.length);

   socket.emit("komta", "komtadasyndar Kazdar");

  });




  socket.on("attack", (card) => {

  const player = komta.players.find(p => p.id === socket.id);
  if (!player) return;

  // карта шынымен бар ма?
  if (!player.cards.includes(card)) return;

  // жүріс кезегі тексеру (қарапайым түрде)
  if (player.turn !== true) {
    socket.emit("error", "Қазір сенің жүрісің емес!");
    return;
  }

  // картаны ойыншыдан алып тастау
  player.cards = player.cards.filter(c => c !== card);

  // үстелге қою
  komta.table = card;

  // бәріне үстелді көрсету
  io.emit("table", card);

  // жаңа карталарын қайта жіберу
  io.to(socket.id).emit("cards", player.cards);

  // жүрісті ауыстыру
  komta.players.forEach(p => p.turn = !p.turn);

});





  socket.on("disconnect",()=>{
    komta.players = komta.players.filter(player => 
    player.id !== socket.id
  );

  console.log("wygyp ketti");
  console.log(komta);
  });

});


// Серверді тыңдаймыз
http.listen(PORT, () => {
  console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});





























