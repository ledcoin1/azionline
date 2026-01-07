// ================== IMPORTS ==================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
require("dotenv").config(); // .env қолдану

// ================== APP / SERVER ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public")); // фронтенд

// ================== MONGO ==================
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected!"))
.catch(err => console.error("🔴 MongoDB connection error:", err));

// ================== SCHEMA ==================
const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: String,
    balance: { type: Number, default: 0 }
});

const User = mongoose.model("User", userSchema);

// ================== SOCKET.IO ==================
io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    socket.on("login", async ({ telegramId, username }) => {
        try {
            let user = await User.findOne({ telegramId });
            if (!user) {
                user = new User({ telegramId, username, balance: 0 });
                await user.save();
            }
            socket.emit("login-success", { username: user.username, balance: user.balance });
        } catch (err) {
            console.error(err);
        }
    });

    socket.on("disconnect", () => {
        console.log("🔴 User disconnected:", socket.id);
    });
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
