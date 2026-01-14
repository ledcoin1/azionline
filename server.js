const io = require("socket.io")(3000);

io.on("connection", socket => {
    console.log("Жаңа ойыншы қосылды:", socket.id);

    // Telegram Mini App арқылы кім қосылғанын көру
    socket.on("playerJoined", player => {
        console.log("Ойыншы Telegram арқылы кірді:", player);
    });

    socket.on("disconnect", () => {
        console.log("Ойыншы шықты:", socket.id);
    });
});
