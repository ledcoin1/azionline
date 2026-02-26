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
  table: [] 
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
    turnTimeout: null
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
if (komta.table.length > 0) {
  console.log("үстелде карта бар");

  // 🟢 Мастьтарды дұрыс алу
  const tableSuit = komta.table[0].slice(-1);   // үстел масты
  const cardSuit = card.slice(-1);              // жүрген карта масты
  const trumpSuit = komta.kozir.slice(-1);      // көзір масты

  console.log("Үстел масты:", tableSuit);
  console.log("Көзір масты:", trumpSuit);
  console.log("Ойыншы карталары:", player.cards);

  // 🟢 Қолында үстел масты бар ма?
  const hasSuit = player.cards.some(c => c.slice(-1) === tableSuit);

  if (hasSuit) {
    // Міндетті түрде сол мастьпен жүру керек
    if (cardSuit !== tableSuit) {
      socket.emit("error", "Сол мастьпен жүру керек!");
      return;
    }

    console.log("✅ Дұрыс мастьпен жүрді");
  } 
  else {
    console.log("❌ Ойыншы қолында үстел масты ЖОҚ");

    // 🟢 Қолында көзір бар ма?
    const hasTrump = player.cards.some(c => c.slice(-1) === trumpSuit);

    if (hasTrump) {
      // Міндетті түрде көзірмен жүру керек
      if (cardSuit !== trumpSuit) {
        socket.emit("error", "Көзірмен жүру керек!");
        return;
      }

      console.log("✅ Көзірмен дұрыс жүрді");
    } 
    else {
      // Масть те жоқ, көзір де жоқ → кез келген карта
      console.log("🔥 Кез келген карта жүруге болады");
    }
  }
  console.log("✅ Жүріс қабылданды");

 // 1️⃣ Картаны үстелге қосу
komta.table.push({ card, playerId: player.id }); // playerId-мен бірге сақтаймыз

// 2️⃣ Ойыншыдан қолынан алып тастау
player.cards = player.cards.filter(c => c !== card);

// 3️⃣ Кезекті ауыстыру
player.turn = false;
const nextPlayer = komta.players.find(p => p.id !== player.id);
if (nextPlayer) {
  nextPlayer.turn = true;
}

// 4️⃣ Клиентке жаңартулар
io.emit("table", komta.table);
io.to(player.id).emit("cards", player.cards);

// 5️⃣ Барлық ойыншылар жүрді ме? → есептеу
if (komta.table.length === komta.players.length) {
  const result = resolveTable(komta); // үстелдегі карталарды есептейтін функция
  const winner = komta.players.find(p => p.id === result.winnerId);

  // Raund санын жаңарту
  winner.raund = (winner.raund || 0) + 1;

  console.log(`🏆 Жеңген ойыншы: ${winner.telegram}, карта: ${result.winningCard}`);

  // Жеңген ойыншыға кезек беру
  komta.players.forEach(p => p.turn = false);
  winner.turn = true;

  // Үстелді тазалау келесі раундқа дайын
  komta.table = [];

  io.emit("table", komta.table);
}
}


  else {
   // 1️⃣ Картаны үстелге қосу
komta.table.push({ card, playerId: player.id }); // playerId-мен бірге сақтаймыз

// 2️⃣ Ойыншыдан қолынан алып тастау
player.cards = player.cards.filter(c => c !== card);

// 3️⃣ Кезекті ауыстыру
player.turn = false;
const nextPlayer = komta.players.find(p => p.id !== player.id);
if (nextPlayer) {
  nextPlayer.turn = true;
}

// 4️⃣ Клиентке жаңартулар
io.emit("table", komta.table);
io.to(player.id).emit("cards", player.cards);

// 5️⃣ Барлық ойыншылар жүрді ме? → есептеу
if (komta.table.length === komta.players.length) {
  const result = resolveTable(komta); // үстелдегі карталарды есептейтін функция
  const winner = komta.players.find(p => p.id === result.winnerId);

  // Raund санын жаңарту
  winner.raund = (winner.raund || 0) + 1;

  console.log(`🏆 Жеңген ойыншы: ${winner.telegram}, карта: ${result.winningCard}`);

  // Жеңген ойыншыға кезек беру
  komta.players.forEach(p => p.turn = false);
  winner.turn = true;

  // Үстелді тазалау келесі раундқа дайын
  komta.table = [];

  io.emit("table", komta.table);
}
  }
});





  socket.on("disconnect",()=>{
    komta.players = komta.players.filter(player => 
    player.id !== socket.id
  );

  console.log("wygyp ketti");
  console.log(komta);
  });

});




function resolveTable(komta) {
  const table = komta.table; // [{ card, playerId }, ...]
  const trumpSuit = komta.kozir.slice(-1);

  let winningCard = table[0].card;
  let winnerId = table[0].playerId;

  const ranks = ["6","7","8","9","10","J","Q","K","A"];

  for (let i = 1; i < table.length; i++) {
    const card = table[i].card;
    const cardSuit = card.slice(-1);
    const winningSuit = winningCard.slice(-1);

    // 🃏 Көзір әрқашан үстем
    if (cardSuit === trumpSuit && winningSuit !== trumpSuit) {
      winningCard = card;
      winnerId = table[i].playerId;
    } 
    // Сол масть болса rank-ы бойынша салыстыру
    else if (cardSuit === winningSuit) {
      if (ranks.indexOf(card.slice(0,-1)) > ranks.indexOf(winningCard.slice(0,-1))) {
        winningCard = card;
        winnerId = table[i].playerId;
      }
    }
  }

  return { winnerId, winningCard };
}





// Серверді тыңдаймыз
http.listen(PORT, () => {
  console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});







































