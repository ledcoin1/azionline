// ================== IMPORTS ==================
require('dotenv').config(); // .env оқу үшін
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

// ================== APP / SERVER ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ================== MIDDLEWARE ==================
app.use(express.static("public"));

// ================== MONGODB CONNECTION ==================
console.log('🚀 MONGO_URI =', process.env.MONGO_URI);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected!'))
.catch(err => console.error('🔴 MongoDB connection error:', err));

// ================== SOCKET.IO LOGIC ==================
const users = {};

io.on("connection", (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);
  users[socket.id] = { balance: 0 }; // Әр ойыншыға бастапқы баланс 0

  socket.on("disconnect", () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
    delete users[socket.id];
  });
});

// ================== SERVER PORT ==================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
