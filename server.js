const express = require("express");  // бұл сайт ашу типа рұқсат 
const http = require("http");            //сервер 
const { Server } = require("socket.io");    //ойнайн байланыс


// сервер жасау үшін //
const app = express();                 // сайт логикасы бұл
const server = http.createServer(app); // порт тыңдайды
const io = new Server(server);         //socket.io орталығы

app.use(express.static("public"));      // public/index.html браузерге ашылады

// Бірінші ойыншыны сақтау
let waitingPlayer = null;               // келген ойыншы сақтаймыз 2 ші ойыншы келгенше

io.on("connection", (socket) => {         // типа клиент миниапп ашқанда кнопка басқанда const socket = io() орындалды 
  console.log("Клиент қосылды");           // жаңа клиент келді деп айтат

  socket.on("joinGame", ({ userId }) => {   // «Егер клиент joinGame десе — осы код»
    console.log("Ойынға қосылды:", userId);

    if (!waitingPlayer) {
      // Бірінші ойыншы күтілуде
      waitingPlayer = { socket, userId };
      socket.emit("message", "Сіз бірінші ойыншы, қарсылас күтілуде...");   // жоғарыда кнопка басқанда 1ші ойыншыны сақтап осылай айтады
   } else {
      // 2-ойыншы
      const first = waitingPlayer;
      waitingPlayer = null;

      // Хабарлар
      first.socket.emit(
        "message",
        `Қарсылас табылды! Екінші ойыншы: ${userId}`
      );
      socket.emit(
        "message",
        `Қарсылас табылды! Бірінші ойыншы: ${first.userId}`
      );

      // Game экран ашу
      first.socket.emit("opponentFound", { opponentId: userId });
      socket.emit("opponentFound", { opponentId: first.userId });


server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

