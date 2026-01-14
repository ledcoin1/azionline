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

    // Telegram Mini App ойыншысы қосылды
    socket.on("playerJoined", player => {
        players[socket.id] = player;
        console.log("Ойыншы Telegram арқылы кірді:", player);
        console.log("Қазіргі ойыншылар:", players);
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
        console.log("Ойыншы шықты:", socket.id);
        console.log("Қалған ойыншылар:", players);
    });
});

http.listen(PORT, () => {
    console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});
