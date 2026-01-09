require("dotenv").config();           //енв файлды оқуға бұл 

const express = require("express");          // кітапханалар
const mongoose = require("mongoose");
const cors = require("cors"); // CORS үшін
const path = require("path");
const http = require("http");       // <- қосамыз
const { Server } = require("socket.io"); // <- қосамы

const app = express();
app.use(cors()); // 🟢 барлық фронтендтен қосылуға рұқсат
app.use(express.json());                 // жсон кабыдау үшін кароче фронтендке

// ===== STATIC FRONTEND =====
app.use(express.static("public"));            // бұл фронтенд 

const server = http.createServer(app);       
const io = new Server(server, {                   
  cors: { origin: "*" } // фронтенд кез келген жерден қосылсын
});

// ===== MONGO =====
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("✅ MongoDB connected!"))        //енв ішіндегі монго арқылы
.catch(e=>console.log("❌ Mongo error", e));

// ===== MODEL =====
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, unique: true },             // монго құжаттары бұл
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

const lobby = {};   // бұл лобби


// socket қосу
io.on("connection", (socket) => {
  const telegramId = socket.handshake.auth.telegramId;

  if(!telegramId){
    socket.disconnect();
    return;
  }

  // MongoDB-ден баланс алу
  User.findOne({ telegramId }).then(user => {
    if(!user) return socket.disconnect();

    // Lobby-ге қосу
    lobby[telegramId] = {
      telegramId,
      socketId: socket.id
    };

    // Тек осы ойыншыға балансын жіберу
    socket.emit("balance", user.balance);

    console.log("🟢 Lobby:", Object.keys(lobby));
  });

  // disconnect кезінде lobby-ден өшіру
  socket.on("disconnect", () => {
    delete lobby[telegramId];
    console.log("❌ Disconnect:", telegramId);
  });
});


const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
