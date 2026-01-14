// Порт автоматты түрде беріледі немесе 3000
const PORT = process.env.PORT || 3000;
const io = require("socket.io")(PORT);

let players = {}; // Қосылған ойыншылар

io.on("connection", socket => {
    console.log("Жаңа ойыншы қосылды:", socket.id);

    // Клиент қосылған кезде Telegram Mini App арқылы хабар
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
