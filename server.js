<!DOCTYPE html>
<html lang="kk">
<head>
<meta charset="UTF-8">
<title>Telegram Game Lobby</title>
<style>
  body { font-family: Arial; background: #111; color: #fff; padding: 20px; }
  h2 { margin-bottom: 10px; }
  #lobby { margin-top: 20px; display:none; }
  ul { list-style: none; padding: 0; }
  li { padding: 4px 0; border-bottom: 1px solid #333; }
  .balance { color: #0f0; font-weight: bold; }
</style>
</head>
<body>

<h2>Telegram Game Lobby</h2>

<div id="lobby">
  <h3>Lobby - Live ойыншылар</h3>
  <ul id="players"></ul>
  <p>Сіздің баланс: <span id="myBalance" class="balance">0</span></p>
</div>

<script src="https://telegram.org/js/telegram-web-app.js"></script>
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"
 integrity="sha384-nvM0HuE4y9XwzDEsGJZ3mZ4Pmg2a0UwvKWK5p4QyPsXx9XxHplhJJt5OWpZbtI6A"
 crossorigin="anonymous"></script>
<script>
const API = ""; // сервер URL, егер сол серверде болса бос қалдырамыз
const socket = io(API);

async function init() {
  const tg = window.Telegram.WebApp;
  const telegramId = tg.initDataUnsafe.user.id; // Telegram ID Mini App арқылы

  // Серверге login
  try {
    const res = await fetch(API + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramId })
    });
    const data = await res.json();

    if(data.error) return alert(data.error);

    document.getElementById("lobby").style.display = "block";
    document.getElementById("myBalance").textContent = data.balance;

    // Socket.IO арқылы joinLobby
    socket.emit("joinLobby", telegramId);

  } catch(err) {
    console.log(err);
    alert("Server error");
  }
}

// Lobby live жаңарту
socket.on("lobbyUpdate", (players) => {
  const ul = document.getElementById("players");
  ul.innerHTML = "";
  players.forEach(id => {
    const li = document.createElement("li");
    li.textContent = id;
    ul.appendChild(li);
  });
});

init();
</script>
</body>
</html>
