const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

// Комната жасау
function createRoom() {
  const roomId = "room-" + Date.now();
  rooms[roomId] = {
    id: roomId,
    players: [],  // {id, name, balance}
    status: "waiting",
    turnIndex: null
  };
  return rooms[roomId];
}

// Кімнің кім екенін табу
function findRoomBySocket(socket) {
  return Object.values(rooms).find(room =>
    room.players.some(p => p.id === socket.id)
  );
}

io.on("connection", (socket) => {
  console.log("Клиент қосылды:", socket.id);

  // JOIN сигнал
  socket.on("join", (playerName) => {
    let room = Object.values(rooms).find(r => r.status === "waiting" && r.players.length < 3);
    if (!room) room = createRoom();

    room.players.push({ id: socket.id, name: playerName, balance: 1000 });
    socket.join(room.id);

    io.to(room.id).emit("room_update", { players: room.players, status: room.status });

    // 3 ойыншы қосылғанда ойын басталады
    if (room.players.length === 3) {
      room.status = "started";
      room.turnIndex = 0;
      io.to(room.id).emit("game_started", { roomId: room.id, players: room.players });

      // Бірінші ойыншыға сигнал
      const firstPlayer = room.players[room.turnIndex];
      io.to(firstPlayer.id).emit("your_turn", { message: "Сіздің кезегіңіз! 50–150 арасында сан таңдаңыз." });
    
      // Тек 1-ойыншыдан 50–150 аралығындағы ставка сигналы
socket.on("first_player_bet", (data) => {
  const room = findRoomBySocket(socket);
  if (!room) return;

  // тек бірінші ойыншы
  if (room.turnIndex !== 0 || room.players[0].id !== socket.id) return;

  let bet = data.bet;
  if (bet < 50 || bet > 150) return;

  // 2 есе көбейту
  bet *= 2;

  // ставка сақтау
  room.firstBet = bet;

  // тек 2-ойыншыға сигнал жіберу
  const secondPlayer = room.players[1];
  io.to(secondPlayer.id).emit("first_player_bet_doubled", { bet });
});

// 2-ойыншыдан "келісемін" сигналы
socket.on("second_player_accept", () => {
  const room = findRoomBySocket(socket);
  if (!room) return;

  if (room.players[1].id !== socket.id) return;

  room.secondPlayerAccepted = true;

   // 1-ойыншының 2 есе көбейтілген ставкасы (100) 2-ойыншының ставкасына айналады
  room.secondPlayerBet = room.firstBet;

  // 2-ойыншының келісімін тағы 2 есе көбейту
  room.secondPlayerBet *= 2; // енді 200

  // тек 3-ойыншыға сигнал
  const thirdPlayer = room.players[2];
  io.to(thirdPlayer.id).emit("second_player_bet_doubled_again", {
    bet: room.secondPlayerBet
  });


});

// 2-ойыншыдан "отбой" сигналы
socket.on("second_player_fold", () => {
  const room = findRoomBySocket(socket);
  if (!room) return;

  if (room.players[1].id !== socket.id) return;

  // 2-ойыншы ойыннан шығады
  room.secondPlayerFolded = true;

  // 1-ойыншының ставкасын өзгеріссіз сақтаймыз (екі еселенген күйде)
  const bet = room.firstBet * 2;

  // тек 3-ойыншыға сигнал
  const thirdPlayer = room.players[2];
  io.to(thirdPlayer.id).emit("second_player_folded_bet", { bet });
});

// 3-ойыншыдан "келісемін" сигналы
socket.on("third_player_accept", () => {
  const room = findRoomBySocket(socket);
  if (!room) return;
  if (room.players[2].id !== socket.id) return;

  room.thirdPlayerAccepted = true;

  // 3-ойыншының ставкасы серверде сақталады (2-ойыншыдан кейінгі соңғы көбейтілген ставка)
  room.thirdPlayerBet = room.secondPlayerBet;

  // Қажет болса, басқа ойыншыларға хабарлау немесе келесі логикаға өту
});

// 3-ойыншыдан "отбой" сигналы
socket.on("third_player_fold", () => {
  const room = findRoomBySocket(socket);
  if (!room) return;
  if (room.players[2].id !== socket.id) return;

  room.thirdPlayerFolded = true;

  // Қажет болса, басқа ойыншыларға хабарлау немесе келесі логика
});



const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server ONLINE on port", PORT));

