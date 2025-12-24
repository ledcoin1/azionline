const express = require("express");
const app = express();

// JSON қабылдау
app.use(express.json());

// Frontend беру
app.use(express.static("public"));

// 🔥 Mini App → Server запрос
app.post("/api/data", (req, res) => {
  console.log("Клиенттен келді:", req.body);

  res.json({
    ok: true,
    serverTime: Date.now(),
    received: req.body
  });
});

// Render порт
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server ONLINE on port", PORT);
});
