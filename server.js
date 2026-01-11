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
const rooms = {};    // комта бұл

function sendBetRequest(roomId) {
  const room = rooms[roomId];
  if(!room) return;

  console.log(`💰 Bet request sent to room: ${roomId}`);

  // Таймер басталғанға дейін барлық ойыншылар "waiting" болады
  room.players.forEach(p => {
    if(p.status !== "waiting") return; // тек waiting
    const sId = lobby[p.id]?.socketId;
    if(!sId) return;

    io.to(sId).emit("betRequest", {
      roomId,
      bet: 500,
      timer: 5
    });
  });

  // Клиент жауап беретін оқиға
  const playerResponseHandler = (socket, data) => {
    const { telegramId, response } = data;
    const player = room.players.find(p => p.id === telegramId);
    if(!player) return;

    if(response === "accepted") player.status = "ready";
    else player.status = "waiting";

    console.log(`✅ ${telegramId} жауап берді: ${player.status}`);
  };

  // Барлық socket-терге тыңдау қосу
  room.players.forEach(p => {
    const sId = lobby[p.id]?.socketId;
    if(!sId) return;
    const socket = io.sockets.sockets.get(sId);
    if(socket) socket.on("playerResponse", data => playerResponseHandler(socket, data));
  });

  // 5 секунд таймер
  setTimeout(() => {
    console.log(`⏱ 5 секунд өтті, кім ready, кім waiting:`);

    room.players.forEach(p => {
      console.log(`${p.id}: ${p.status}`);
    });

    const readyPlayers = room.players.filter(p => p.status === "ready");
    console.log("🎯 Ready ойыншылар:", readyPlayers.map(p => p.id));

    // Таймер аяқталған соң handler-ді өшіру
    room.players.forEach(p => {
      const sId = lobby[p.id]?.socketId;
      if(!sId) return;
      const socket = io.sockets.sockets.get(sId);
      if(socket) socket.off("playerResponse", playerResponseHandler);
    });

  }, 5000);
}




// socket қосу
io.on("connection", (socket) => {                        // қосылу
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
  

 let roomToJoin = null;
    for(const roomId in rooms){
      const room = rooms[roomId];
      if(room.players.length < room.maxPlayers){
        roomToJoin = room;
        break;
      }
    }

    if(roomToJoin){
      // Бос орын бар room → жаңа ойыншыны қосу
      roomToJoin.players.push({
        id: telegramId,
  status: "waiting"});
      console.log(`🟢 ${telegramId} joined existing room ${roomToJoin.roomId}`);
       sendBetRequest(roomToJoin.roomId); // 👈 ОСЫ ДҰРЫС
       



      // Барлық room ойыншыларына хабарлау
      roomToJoin.players.forEach(id => {
        const sId = lobby[id]?.socketId || io.sockets.sockets.get(id);
        if(sId) io.to(sId).emit("joinedRoom", {
          roomId: roomToJoin.roomId,
          players: roomToJoin.players
        });
      });

      // Lobby-ден өшіру
      delete lobby[telegramId];
    }
    else {
      // Егер бос room жоқ және лобби-де 2+ ойыншы болса → жаңа room жасау
      const lobbyPlayers = Object.keys(lobby);
      if(lobbyPlayers.length >= 2){
        const playersForRoom = lobbyPlayers.slice(0, 5); // максимум 5
        const roomId = "room-" + Date.now();

        rooms[roomId] = {
          roomId,
          maxPlayers: 5,
          players: playersForRoom.map(id=> ({
            id,
            status: "waiting"   // 👈 БАРЛЫҒЫ WAITING
          }))
          
        };

        console.log("🟢 New room created:", roomId, rooms[roomId].players);
          sendBetRequest(roomId);
          console.log("💰 Bet request sent to room:", roomId); //сұрақ


        // Lobby-ден өшіру
        playersForRoom.forEach(id => delete lobby[id]);

        // Ойыншыларға хабарлау
        playersForRoom.forEach(id => {
          const sId = lobby[id]?.socketId || io.sockets.sockets.get(id);
          if(sId) io.to(sId).emit("joinedRoom", {
            roomId,
            players: playersForRoom
          });
        });
      }
    }

  });

  // ================== DISCONNECT ==================
  socket.on("disconnect", () => {
    delete lobby[telegramId];

    // Room-дан өшіру
    for(const roomId in rooms){
      const room = rooms[roomId];
      const idx = room.players.indexOf(telegramId);
      if(idx !== -1){
        room.players.splice(idx,1);
        // Барлық қалған ойыншыларға жаңарту хабарлау
        room.players.forEach(id => {
          const sId = lobby[id]?.socketId || io.sockets.sockets.get(id);
          if(sId) io.to(sId).emit("joinedRoom", {
            roomId,
            players: room.players
          });
        });

        // Егер room бос болса → өшіру
        if(room.players.length === 0){
          delete rooms[roomId];
          console.log(`❌ Room ${roomId} deleted (empty)`);
        }
      }
    }

    console.log("❌ Disconnect:", telegramId);
  });
});






// ================== SERVER ==================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log("🚀 Server running on port", PORT));
