// ================== IMPORTS ==================
require('dotenv').config();        // .env файлдан MONGO_URI алу
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

// ================== APP / SERVER ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public")); // public қалтасын serve ету

// ================== MONGODB CONNECTION ==================
const uri = process.env.MONGO_URI; // .env немесе Render env variable
console.log('🚀 MONGO_URI =', uri);

mongoose.connect(uri, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.log('🔴 MongoDB connection error:', err));

// ================== SOCKET.IO ==================
io.on("connection", (socket) => {
    console.log('🟢 User connected:', socket.id);

    socket.on("disconnect", () => {
        console.log('🔴 User disconnected:', socket.id);
    });
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
