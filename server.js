const PORT = process.env.PORT || 3000;  // Render автоматты PORT береді
const io = require("socket.io")(PORT);

let players = {};

io.on("connection", socket => {
    console.log("Жаңа ойыншы қосылды:", socket.id);

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

console.log(`Socket.IO сервер ${PORT} портында жұмыс істеп тұр`);
