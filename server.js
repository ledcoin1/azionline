// ================== IMPORTS ==================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
require("dotenv").config();

// ================== APP / SERVER ==================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }, // Telegram клиентімен байланыс үшін
});

app.use(express.json());
app.use(express.static("public")); // Фронтенд үшін public папка

// ================== MONGOOSE ==================
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected!"))
  .catch((err) => console.error("🔴 MongoDB connection error:", err));

// ================== USER MODEL ==================
const userSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: { type: String },
    balance: { type: Number, default: 0 },
});

const User = mongoose.model("User", userSchema);

// ================== SOCKET.IO ==================
io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // Telegram арқылы логин
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
            socket.emit("login-fail", { message: "Server error" });
        }
    });

    socket.on("disconnect", () => {
        console.log("🔴 User disconnected:", socket.id);
    });
});

// ================== ADMIN API ==================
// Бұл API арқылы админ балансты жаңарта алады
app.post("/admin/update-balance", async (req, res) => {
    const { telegramId, balance } = req.body;
    if (!telegramId || balance === undefined)
        return res.status(400).json({ message: "Missing fields" });

    try {
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: "User not found" });

        user.balance = balance;
        await user.save();
        res.json({ message: "Balance updated!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
