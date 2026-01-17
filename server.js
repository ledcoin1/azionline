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

let players = {};
let lobby = [];
let rooms = {};



function dealCards(roomId){

  const acceptedPlayers = rooms[roomId].filter(
    p => p.betAnswer === true
  );

  const deck = [
   "6♠","7♠","8♠","9♠","10♠","J♠","Q♠","K♠","A♠",
   "6♥","7♥","8♥","9♥","10♥","J♥","Q♥","K♥","A♥",
   "6♦","7♦","8♦","9♦","10♦","J♦","Q♦","K♦","A♦",
   "6♣","7♣","8♣","9♣","10♣","J♣","Q♣","K♣","A♣"
  ];

  deck.sort(() => Math.random() - 0.5);

  acceptedPlayers.forEach(player => {
    player.cards = deck.splice(0,3);

    io.to(player.socketId).emit("yourCards", {
      cards: player.cards
    });
  });
}




io.on("connection", socket => {
  console.log("Жаңа ойыншы қосылды:", socket.id);

  socket.on("playerJoined", player => {
    const roomId = "room_1";

    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = [];

    const playerData = {
      socketId: socket.id,
      ...player,
      status: "waiting"
    };

    rooms[roomId].push(playerData);

    io.to(socket.id).emit("roomData", rooms[roomId]);
    socket.to(roomId).emit("playerJoinedRoom", player);

    io.to(socket.id).emit("askBet", {
      question: "Ставка 500",
      amount: 500
    });
  });


  socket.on("betResponse", ({ accepted }) => {

    const roomId = "room_1";
    if (!rooms[roomId]) return;

    const player = rooms[roomId].find(
      p => p.socketId === socket.id
    );

    if (!player) return;

    // жауапты сақтау
    player.betAnswer = accepted;

    console.log(
      "Жауап сақталды:",
      player.name,
      "->",
      accepted ? "ҚАБЫЛДАДЫ" : "БАС ТАРТТЫ"
    );

    // 🔥 БАРЛЫҒЫ ЖАУАП БЕРДІ МЕ?
    const allAnswered = rooms[roomId].every(
      p => p.betAnswer !== undefined
    );

    if(allAnswered){
      dealCards(roomId); // 👈 МІНЕ ДҰРЫС ОРНЫ
    }
  });







  // disconnect тыңдағышы да осы жерде
  socket.on("disconnect", () => {
    console.log("Ойыншы disconnect:", socket.id);
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(p => p.socketId !== socket.id);
      if (rooms[roomId].length === 0) delete rooms[roomId];
    }
  });

}); // <-- io.on("connection") жабылды


http.listen(PORT, () => {
  console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});















