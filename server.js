const { Server } = require("socket.io");
const io = new Server(3000);

io.on("connection", socket => {
  console.log("Клиент қосылды");

  // Клиент хабар жібергенде орындалады
  socket.on("joinGame", ({ userId }) => {
    console.log("Ойынға қосылды:", userId);

    // Клиентке хабар жібереміз
    socket.emit("message", "Сіз ойынға қосылдыңыз!");
  });
});
