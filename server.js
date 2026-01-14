const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = process.env.PORT || 3000;

// public ішін serve ету
app.use(express.static("public"));

let players = {}; // socket.id: telegramUser

io.on("connection", socket => {
    console.log("Жаңа ойыншы қосылды:", socket.id);

})

http.listen(PORT, () => {
    console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});


