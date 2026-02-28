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

function checkGameWinner(komta) {

  const gameWinner = komta.players.find(p => p.raund >= 2);
  if (!gameWinner) return;

  console.log(`🏆 КОМТА ЖЕҢІМПАЗЫ: ${gameWinner.telegram}`);

  io.emit("gameWinner", {
    telegram: gameWinner.telegram,
    balans: gameWinner.balans
  });

  // 🔥 3 секунд күтеміз (клиент көрсетуі үшін)
  setTimeout(() => {

    console.log("♻️ Комта толық тазартылды");

    // Үстел тазалау
    komta.table = [];
    komta.table2 = [];

    // Ойыншыларды толық тазалау
    komta.players = [];

    // Клиентке бос күй жіберу
    io.emit("table", []);
    io.emit("players", []);
    io.emit("resetGame");

  }, 3000);
}


let komta = {

  players:[],
   phase: "waiting", 
  decisionPlayer: null,
  card: null,
  obwiBalans: 0,
  zhenis: null,
  raund: null,
  kozir: null,
  table: [],
  table2: []
};

function startDecisionPhase(player){
  komta.phase = "decision";
  komta.decisionPlayer = player.id;

  io.to(player.id).emit("makeDecision", {
    options: ["podnyat", "gotov", "brosit"]
  });
}

function resolveTable(komta) {
  const table = komta.table;   // ["9♥", "J♠", ...]
  const players = komta.table2; // ["id1", "id2", ...]

  const trumpSuit = komta.kozir.slice(-1); // көзір масты
  const ranks = ["6","7","8","9","10","J","Q","K","A"];

  // Бастапқы жеңімпаз — бірінші карта
  let winningCard = table[0];
  let winnerId = players[0];

  for (let i = 1; i < table.length; i++) {
    const card = table[i];
    const cardSuit = card.slice(-1);
    const winningSuit = winningCard.slice(-1);

    if (cardSuit === trumpSuit && winningSuit !== trumpSuit) {
      winningCard = card;
      winnerId = players[i];
    } else if (cardSuit === winningSuit) {
      if (ranks.indexOf(card.slice(0,-1)) > ranks.indexOf(winningCard.slice(0,-1))) {
        winningCard = card;
        winnerId = players[i];
      }
    }
  }

  return { winnerId, winningCard };
}

io.on("connection", (socket) => {

  console.log("ойыншы кірді")


  socket.on("play", async (data) => {

  try {

    if (komta.players.length >= 2) {
      socket.emit("toly", "2 adam bar");
      return;
    }

    const telegramId = data.telegramId;
    if (!telegramId) return;

    // 🔎 БАЗАДАН ҚОЛДАНУШЫНЫ ТАБУ
    const user = await User.findOne({ telegramId });

    if (!user) {
      console.log("❌ Қолданушы табылмады");
      socket.emit("error", "User not found");
      return;
    }

    console.log("👤 Ойыншы балансы:", user.balance);

    // 💰 БАЛАНС ТЕКСЕРУ
    if (user.balance < 500) {
      console.log("⛔ Баланс жеткіліксіз:", user.balance);
      socket.emit("balanceError", "Баланс 500-ден төмен");
      return;
    }

      // 🔥 500 АЛАМЫЗ
    user.balance -= 500;
    await user.save();

    // 🔥 БАНККЕ ҚОСАМЫЗ
    komta.obwiBalans += 500;

    console.log("💰 Комта банкі:", komta.obwiBalans);

    // ✅ ОЙЫНҒА ҚОСУ
    komta.players.push({
      id: socket.id,
      telegram: telegramId,
      cards: [],
      turn: null,
      status: "azirshe",
      balans: user.balance,   // базадағы нақты баланс
      raund: 0,
      turnTimeout: null
    });

    console.log("✅ Ойыншы қосылды:", telegramId);

    io.emit("players", komta.players);

  } catch (err) {
    console.log("❌ Play қатесі:", err);
  }



    

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

  startDecisionPhase(komta.players[0]);

    
    console.log("Көзір карта:", komta.kozir);
    console.log(komta.players[0].cards);
    console.log(komta.players[1].cards);
    console.log(deck.length);

    
    console.log("Ойыншылар:", komta.players);

    socket.emit("komta", "komtadasyndar Kazdar");
}});


  socket.on("decision", (choice) => {

  if(komta.phase !== "decision") return;

  if(socket.id !== komta.decisionPlayer){
    socket.emit("error","Қазір сен шешім қабылдамайсың");
    return;
  }

  console.log("Ойыншы таңдады:", choice);

  if(choice === "podnyat"){
    console.log("Ойыншы көтерді");
    komta.phase = "playing";
  }

  if(choice === "gotov"){
    console.log("Ойыншы дайын");
    komta.phase = "playing";
  }

  if(choice === "brosit"){
    console.log("Ойыншы тастады");
    komta.phase = "playing";
  }

});


socket.on("attack", (card) => {

   if(komta.phase !== "playing"){
    socket.emit("error","Алдымен шешім қабылдау керек!");
    return;
     }
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

  // Картаны үстелге салу
komta.table.push(card);
  komta.table2.push(player.id);

// Қолдан алып тастау
player.cards = player.cards.filter(c => c !== card);

// Кезекті ауыстыру
player.turn = false;

const nextPlayer = komta.players.find(p => p.id !== player.id);
if (nextPlayer) {
  nextPlayer.turn = true;
}

// Клиентке жіберу
io.emit("table", komta.table);
io.to(player.id).emit("cards", player.cards);


   // Барлық ойыншылар жүрді ме?
    if (komta.table.length === komta.players.length) {
        console.log("✅ Барлық ойыншылар жүрді — үстел толық");
      const result = resolveTable(komta);
      const winner = komta.players.find(p => p.id === result.winnerId);


       if (!winner) return;

  // 👇 МІНЕ ОСЫ ЖЕР
  winner.raund += 1;

       console.log(`🏆 Раунд жеңімпазы: ${winner.telegram}`);
  console.log(`🔥 Оның раунд саны: ${winner.raund}`);

  checkGameWinner(komta); // 👈 осында



        komta.players.forEach(p => p.turn = false);
  winner.turn = true;
  // Үстелді тазалау келесі раундқа
  komta.table = [];
  komta.table2 = [];
  io.emit("table", komta.table);
  io.emit("players", komta.players);
    } else {
        console.log(`ℹ️ Жүрген ойыншылар саны: ${komta.table.length}/${komta.players.length}`);
    }
}


  else {
    console.log("karta zhok ustelde");

   komta.table.push(card);
    komta.table2.push(player.id);
    player.cards = player.cards.filter(c=>c !== card);

     // 3️⃣ Кезекті ауыстыру
  player.turn = false;

  const nextPlayer = komta.players.find(p => p.id !== player.id);
  if (nextPlayer) {
    nextPlayer.turn = true;
  }
    io.emit("table",komta.table);
    io.to(player.id).emit("cards", player.cards);

     // Барлық ойыншылар жүрді ме?
    if (komta.table.length === komta.players.length) {
        console.log("✅ Барлық ойыншылар жүрді — үстел толық");
      const result = resolveTable(komta);
      const winner = komta.players.find(p => p.id === result.winnerId);
       console.log(`🏆 Жеңген ойыншы: ${winner.telegram}, карта: ${result.winningCard}`);
    } else {
        console.log(`ℹ️ Жүрген ойыншылар саны: ${komta.table.length}/${komta.players.length}`);
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








// Серверді тыңдаймыз
http.listen(PORT, () => {
  console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});















































