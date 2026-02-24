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






function kartaTaratu(){
  const emblmas = ["♥", "♦", "♣", "♠"];
  const sandars =["6","7","8","9","10","J","Q","K","A"];
  let deck = [];

  for(let emblma of emblmas){
    for(let sandar of sandars){
      deck.push(sandar + emblma);
    }
  }

  return deck;
}


let d = kartaTaratu();
console.log(d);


function shuffle(deck) {
  // i = соңғы индекстен бастап 1-ге дейін
  for (let i = deck.length - 1; i > 0; i--) {
    // 0 ... i аралығынан кездейсоқ индекс таңдаймыз
    let j = Math.floor(Math.random() * (i + 1));

    // deck[i] мен deck[j] орындарын ауыстырамыз
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

let deck = kartaTaratu(); // 36 карта дайын
shuffle(deck);             // араласты
console.log(deck);         // енді әр түрлі ретпен



let komta = {

  players:[],
  card: null,
  obwiBalans: null,
  zhenis: null,
  raund: null,
  kozir: null,
  turnTimeout: null

};





io.on("connection", (socket) => {

  console.log("ойыншы кірді")


  socket.on("play",(data)=>{



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
    raund: null,
     table: []
   });
   

    

if (komta.players.length === 2) {   // егер 2 ойыншы кірсе
    deck = kartaTaratu();             
    shuffle(deck);                    

    komta.players.forEach(player => {
      for (let i = 0; i < 3; i++) {
        let card = deck[0];
        player.cards.push(card);
        deck.splice(0,1);
      }
      io.to(player.id).emit("cards", player.cards);
    });

     komta.kozir = deck[0];  
    deck.splice(0,1); 

      
    
    
komta.players[0].turn = true;
komta.players[1].turn = false;

    
    console.log("Көзір карта:", komta.kozir);
    console.log(komta.players[0].cards);
    console.log(komta.players[1].cards);
    console.log(deck.length);

    
    console.log("Ойыншылар:", komta.players);

    socket.emit("komta", "komtadasyndar Kazdar");
}});


socket.on("attack", (card) => {

  const player = komta.players.find(p => p.id === socket.id);
  if (!player) return;

  // Қолында карта бар ма?
  if (!player.cards.includes(card)) {
    socket.emit("error", "Сенде мұндай карта жоқ!");
    return;
  }

  // ⚡ Turn тексеру: ойыншының кезегі ме?
  if (!player.turn) {
    socket.emit("error", "Қазір сенің жүрісің емес!");
    return;
  }

  console.log(`${player.telegram} дұрыс карта жіберді және turn дұрыс: ${card}`);
  });

socket.on("disconnect",()=>{
    komta.players = komta.players.filter(player => 
    player.id !== socket.id
  );
  });

// Серверді тыңдаймыз
http.listen(PORT, () => {
  console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});














































