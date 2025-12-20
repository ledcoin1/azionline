// express + http + socket.io
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// express қосамыз
const app = express();
const server = http.createServer(app);

// socket.io орнатамыз
const io = new Server(server);

// статикалық файлдар (index.html) үшін
app.use(express.static("public"));

// Клиент қосылғанда орындалатын код
io.on("connection", (socket) => {
  console.log("Клиент қосылды"); // сервер логына шығарылады
});

// серверді порт 3000-де іске қосамыз
server.listen(3000, () => console.log("Server running on http://localhost:3000"));
