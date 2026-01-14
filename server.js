const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

// барлық ойыншылар object
let players = {}; // socket.id: player

// лобби массиві
let lobby = []; // ойыншылар тізімі

// ойын бөлмелері
let rooms = {}; // roomId: [player1, player2]

io.on("connection", socket => {
    console.log("Жаңа ойыншы қосылды:", socket.id);

    socket.on("playerJoined", player => {
        // 1️⃣ сервердегі объектке қосу
        players[socket.id] = player;

        // 2️⃣ лобби массивіне қосу
        lobby.push({socketId: socket.id, player: player});
        console.log("Қазіргі лобби:", lobby);

        // 3️⃣ Егер лоббида 2 адам болса → бөлме жасау
        if(lobby.length >= 2){
            const roomId = `room_${Date.now()}`; // уникальды бөлме ID
            const player1 = lobby.shift(); // бірінші адам лоббиден шығарылады
            const player2 = lobby.shift(); // екінші адам

            rooms[roomId] = [player1, player2];
            console.log("Жаңа бөлме жасалды:", roomId, rooms[roomId]);

            // бөлмедегі ойыншыларға хабар жіберу
            player1.socketId && io.to(player1.socketId).emit("roomCreated", {roomId, players: rooms[roomId]});
            player2.socketId && io.to(player2.socketId).emit("roomCreated", {roomId, players: rooms[roomId]});
        }
    });

    socket.on("disconnect", () => {
        // 1️⃣ объектіден өшіру
        delete players[socket.id];

        // 2️⃣ лоббиден өшіру
        lobby = lobby.filter(p => p.socketId !== socket.id);

        console.log("Ойыншы шықты:", socket.id);
        console.log("Қазіргі лобби:", lobby);

        // бөлмеден өшіру
        for(const roomId in rooms){
            rooms[roomId] = rooms[roomId].filter(p => p.socketId !== socket.id);
            // егер бөлмеде ешкім қалмаса
            if(rooms[roomId].length === 0) delete rooms[roomId];
        }

        console.log("Қазіргі бөлмелер:", rooms);
    });
});

http.listen(PORT, () => {
    console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});
