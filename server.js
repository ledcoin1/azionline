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

async function checkGameWinner(komta) {
  const gameWinner = komta.players.find(p => p.raund >= 2);
  if (!gameWinner) return;

  const prize = komta.obwiBalans;

  console.log(`🏆 ЖЕҢІМПАЗ: ${gameWinner.telegram}, ұтып алған: ${prize}`);

  // 🔥 БАЗАДАН ТАБУ
  const user = await User.findOne({ telegramId: gameWinner.telegram });
  if (!user) return;

  // 🔥 БАЗАҒА ҚОСУ
  user.balance += prize;
  await user.save();

  // 🔥 ОБЪЕКТТІ ДЕ ЖАҢАРТУ (клиентке көрсету үшін)
  gameWinner.balans = user.balance;

  komta.obwiBalans = 0;

  io.emit("gameWinner", {
    telegram: gameWinner.telegram,
    balans: user.balance,
    prize: prize
  });

  setTimeout(() => {
    komta.players = [];
    komta.table = [];
    komta.table2 = [];
    komta.deck = [];
    komta.kozir = null;
    komta.obwiBalans = 0;

    io.emit("resetGame");
  }, 3000);
}


let rooms = []; // барлық комталарды сақтау

function createKomta() {
  return {
    id: "room_" + Date.now(), // 🔥 МАҢЫЗДЫ
    players: [],
    deck: [],
    kozir: null,
    table: [],
    table2: [],
    obwiBalans: 0
  };
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
  console.log("ойыншы кірді");

  socket.on("play", async (data) => {
    try {
      const telegramId = data.telegramId;
      if (!telegramId) return;

      // 🔹 Егер ойыншы бұрыннан комтада болса, қайта қосылуына жол бермейміз
      let existingPlayer = rooms.some(r => r.players.some(p => p.telegram === telegramId));
      if (existingPlayer) {
        console.log("❌ Ойыншы бұрыннан ойында:", telegramId);
        socket.emit("error", "Сен қазір комтадасың");
        return;
      }

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

      // 🔹 Бос комта іздеу, тек 2 ойыншыға дейін
      let komta = rooms.find(r => r.players.length < 2 && r.players.length > 0);

      // 🔹 Егер бос комта жоқ → жаңа комта жасау
      if (!komta) {
        komta = createKomta();
        rooms.push(komta);
      }

      // ✅ ОЙЫНҒА ҚОСУ (алдында балансты азайтуды кейінге шегереміз)
      komta.players.push({
        id: socket.id,
        telegram: telegramId,
        cards: [],
        turn: null,
        status: "azirshe",
        balans: user.balance,
        raund: 0,
        turnTimeout: null
      });
      socket.join(komta.id);

      console.log("✅ Ойыншы қосылды:", telegramId);
      io.to(komta.id).emit("players", komta.players);

      // 🔹 Егер комтада 2 адам болса, ойын бастау
      if (komta.players.length === 2) {

        // 🔥 Енді тек 2 ойыншыға ғана 500 алу
        for (let player of komta.players) {
          const userDb = await User.findOne({ telegramId: player.telegram });
          if (!userDb || userDb.balance < 500) {
            // біреу баланс жеткіліксіз болса комта басталмайды
            socket.emit("balanceError", "Біреуінің балансы жеткіліксіз");
            return;
          }
          userDb.balance -= 500;
          await userDb.save();
          player.balans = userDb.balance;
          komta.obwiBalans += 500;
        }

        console.log("💰 Комта банкі:", komta.obwiBalans);

        // 🔹 Колода және карталарды тарату
        komta.deck = kartaTaratu();
        shuffle(komta.deck);

        komta.players.forEach(player => {
          for (let i = 0; i < 3; i++) {
            let card = komta.deck.shift(); // бірінші картаны алып тастау
            player.cards.push(card);
          }
          io.to(player.id).emit("cards", player.cards);
        });

        // 🔹 Көзір картаны орнату
        komta.kozir = komta.deck.shift();
        io.to(komta.id).emit("kozir", komta.kozir);

        // 🔹 Кезекті белгілеу
        komta.players[0].turn = true;
        komta.players[1].turn = false;
        io.to(komta.id).emit("players", komta.players);

        console.log("Көзір карта:", komta.kozir);
        console.log("Ойыншылар:", komta.players);

        // 🔹 Таймерді шақыру
        fiveSecondConsoleTimer(komta, komta.table.length);
      }

    } catch (err) {
      console.log("❌ Play қатесі:", err);
    }
  });

  // 🔹 attack логикасын өзгеріссіз қалдырдық
  socket.on("attack", async (card) => {
    // кімнің комтасында ойнап отырғанын табу
    let komta = rooms.find(r => r.players.some(p => p.id === socket.id));
    if (!komta) return;

    const player = komta.players.find(p => p.id === socket.id);
    if (!player) return;

    if (!player.cards.includes(card)) {
      socket.emit("error", "Сенде мұндай карта жоқ!");
      return;
    }

    if (!player.turn) {
      socket.emit("error", "Қазір сенің жүрісің емес!");
      return;
    }

    console.log(`${player.telegram} дұрыс карта жіберді: ${card}`);

    if (komta.table.length > 0) {
      const tableSuit = komta.table[0].slice(-1);
      const cardSuit = card.slice(-1);
      const trumpSuit = komta.kozir.slice(-1);

      const hasSuit = player.cards.some(c => c.slice(-1) === tableSuit);

      if (hasSuit && cardSuit !== tableSuit) {
        socket.emit("error", "Сол мастьпен жүру керек!");
        return;
      } else if (!hasSuit) {
        const hasTrump = player.cards.some(c => c.slice(-1) === trumpSuit);
        if (hasTrump && cardSuit !== trumpSuit) {
          socket.emit("error", "Көзірмен жүру керек!");
          return;
        }
      }
    }

    // карта үстелге
    komta.table.push(card);
    komta.table2.push(player.id);
    player.cards = player.cards.filter(c => c !== card);

    // кезекті ауыстыру
    player.turn = false;
    const nextPlayer = komta.players.find(p => p.id !== player.id);
    if (nextPlayer) nextPlayer.turn = true;

    // Кезек келгенде шақыру
    fiveSecondConsoleTimer(komta, komta.table.length);

    io.to(komta.id).emit("table", komta.table);
    io.to(player.id).emit("cards", player.cards);

    if (komta.table.length === komta.players.length) {
      const result = resolveTable(komta);
      const winner = komta.players.find(p => p.id === result.winnerId);
      if (winner) winner.raund += 1;

      await checkGameWinner(komta);

      komta.players.forEach(p => p.turn = false);
      if (winner) winner.turn = true;

      komta.table = [];
      komta.table2 = [];
      io.to(komta.id).emit("table", komta.table);
      io.to(komta.id).emit("players", komta.players);
    }
  
});

  // 🔹 disconnect
 socket.on("disconnect", async () => {
  // кімнің комтасында екенін тауып алу
  let komta = rooms.find(r => r.players.some(p => p.id === socket.id));
  if (!komta) return;

  // шығып кеткен ойыншы
  const leaver = komta.players.find(p => p.id === socket.id);

  // қалған ойыншы
  const remainingPlayer = komta.players.find(p => p.id !== socket.id);

  console.log("Ойыншы кетті:", socket.id);

  // ойынға тек 2 адам қатысса және біреуі кетті → қалғанын жеңімпаз етіп беру
  if (komta.players.length === 2 && remainingPlayer) {
    console.log("🏆 Жеңімпаз қалған ойыншы:", remainingPlayer.telegram);

    // балансқа комта банкін қосу
    remainingPlayer.balans += komta.obwiBalans;

    // егер базада сақтағың келсе:
    const user = await User.findOne({ telegramId: remainingPlayer.telegram });
    if (user) {
      user.balance = remainingPlayer.balans;
      await user.save();
    }

    // клиентке жіберу
    io.to(remainingPlayer.id).emit("gameWinner", {
      telegram: remainingPlayer.telegram,
      balans: remainingPlayer.balans,
      prize: komta.obwiBalans
    });

    // комта банкін тазалау
    komta.obwiBalans = 0;
  }

  // ойыншыны комтадан жою
  komta.players = komta.players.filter(p => p.id !== socket.id);

  // егер комта бос қалса, оны rooms тізімінен шығару
  if (komta.players.length === 0) {
    rooms = rooms.filter(r => r !== komta);
    console.log("Комта бос, жойылды");
  } else {
    // қалған ойыншыларға жаңартылған тізім
    komta.players.forEach(p => io.to(p.id).emit("players", komta.players));
  }
});


});



async function fiveSecondConsoleTimer(komta, initialTableLength) {

  if (komta.timer) {
    clearInterval(komta.timer);
  }

  let seconds = 10;

  console.log("⏳ Таймер басталды");

  komta.timer = setInterval(async () => {

    if (komta.table.length > initialTableLength) {
      console.log("✅ Ойыншы жүрді");
      clearInterval(komta.timer);
      return;
    }

    console.log(`⏱ Қалды: ${seconds} сек`);

     // 🔹 Клиентке жіберу
  komta.players.forEach(p => {
    io.to(p.id).emit("turnTimer", seconds);
  });
    seconds--;

    if (seconds < 0) {
      clearInterval(komta.timer);
      console.log("❌ Ойыншы жүрмеді (5 секунд бітті)");

      // Кезегі келген ойыншы
      const playerWhoDidntMove = komta.players.find(p => p.turn);
      if (!playerWhoDidntMove) {
        console.log("⚠ Кезек алған ойыншы табылмады");
        return;
      }

      // Қарсыласы
      const winner = komta.players.find(p => p.id !== playerWhoDidntMove.id);
      if (!winner) {
        console.log("⚠ Қарсылас табылмады");
        return;
      }

      console.log(`🏆 Жеңімпаз: ${winner.telegram}`);

      try {

        // 🔹 БАЗАДАН табу
        const user = await User.findOne({ telegramId: winner.telegram });

        if (user) {
          user.balance += komta.obwiBalans;
          await user.save();

          winner.balans = user.balance;
        } else {
          console.log("⚠ Winner User табылмады базада");
          winner.balans += komta.obwiBalans;
        }

      } catch (err) {
        console.log("❌ Баланс сақтау қатесі:", err);
      }

      // 🔹 Барлығына жібереміз
      io.emit("gameWinner", {
        telegram: winner.telegram,
        balans: winner.balans,
        prize: komta.obwiBalans
      });

      // 🔹 Кезекті өшіру
      komta.players.forEach(p => p.turn = false);

      // 🔹 Комтаны тазалау
      setTimeout(() => {

        komta.players = [];
        komta.table = [];
        komta.table2 = [];
        komta.deck = [];
        komta.kozir = null;
        komta.obwiBalans = 0;

        io.emit("resetGame");
        console.log("🧹 Комта тазаланды");

      }, 3000);
    }

  }, 1000);
}


// Серверді тыңдаймыз
http.listen(PORT, () => {
  console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});





































































