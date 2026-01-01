<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Mini Game</title>

  <!-- Telegram Mini App -->
  <script src="https://telegram.org/js/telegram-web-app.js"></script>

  <!-- Socket.IO -->
  <script src="/socket.io/socket.io.js"></script>

  <style>
    * {
      box-sizing: border-box;
      font-family: Inter, Arial, sans-serif;
    }

    body {
      margin: 0;
      height: 100vh;
      background: linear-gradient(160deg, #0f172a, #020617);
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .app {
      width: 100%;
      max-width: 420px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      text-align: center;
    }

    h1 {
      margin: 0 0 10px;
      font-size: 26px;
    }

    .subtitle {
      opacity: 0.7;
      margin-bottom: 24px;
    }

    button {
      width: 100%;
      padding: 16px;
      border-radius: 16px;
      border: none;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: #022c22;
      transition: transform .15s ease, opacity .15s ease;
    }

    button:active {
      transform: scale(0.97);
      opacity: 0.9;
    }

    .status {
      margin-top: 20px;
      font-size: 16px;
      opacity: 0.85;
    }

    .room {
      margin-top: 20px;
      text-align: left;
      background: rgba(0,0,0,0.3);
      padding: 16px;
      border-radius: 14px;
    }

    .player {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    .player:last-child {
      border-bottom: none;
    }

    .balance {
      font-weight: 600;
      color: #22c55e;
    }
  </style>
</head>
<body>

<div class="app">
  <h1>♠ Mini Game</h1>
  <div class="subtitle">Ойынға қосылу үшін басыңыз</div>

  <button id="playBtn">🎮 Играть</button>

  <div class="status" id="status"></div>

  <div class="room" id="room" style="display:none;">
    <strong>Комната:</strong>
    <div id="players"></div>
  </div>
</div>

<script>
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }

  const socket = io();

  const playBtn = document.getElementById("playBtn");
  const statusEl = document.getElementById("status");
  const roomEl = document.getElementById("room");
  const playersEl = document.getElementById("players");

  playBtn.addEventListener("click", () => {
    statusEl.textContent = "⏳ Күтуде...";
    playBtn.disabled = true;
    playBtn.style.opacity = 0.6;

    socket.emit("play");
  });

  socket.on("waiting", (data) => {
    statusEl.textContent = `👥 Ойыншылар: ${data.count} / ${data.needed}`;
  });

  socket.on("room_joined", (data) => {
    statusEl.textContent = `🏠 Комната ашылды: ${data.roomId}`;
    roomEl.style.display = "block";

    playersEl.innerHTML = "";

    data.players.forEach((player, index) => {
      const div = document.createElement("div");
      div.className = "player";
      div.innerHTML = `
        <span>Игрок ${index + 1}</span>
        <span class="balance">${player.balance}</span>
      `;
      playersEl.appendChild(div);
    });
  });
</script>

</body>
</html>
