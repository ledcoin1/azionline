const socket = io();

// Telegram Mini App user (мысал үшін статикалық, шын Telegram дерегімен ауыстыр)
const telegramUser = {
  id: Math.floor(Math.random() * 100000), // Telegram ID нақты болуы керек
  username: "User" + Math.floor(Math.random() * 1000)
};

const joinBtn = document.getElementById("joinBtn");
const lobbyDiv = document.getElementById("lobby");
const roomDiv = document.getElementById("room");

// Лоббиге қосылу
joinBtn.addEventListener("click", () => {
  socket.emit("playerJoined", telegramUser);
  joinBtn.disabled = true;
  joinBtn.textContent = "Сіз қосылды";
});

// Лобби жаңарту
socket.on("lobbyUpdate", lobbyPlayers => {
  lobbyDiv.innerHTML = "";
  lobbyPlayers.forEach(p => {
    const div = document.createElement("div");
    div.classList.add("player");
    div.textContent = p.player.username;
    lobbyDiv.appendChild(div);
  });
});

// Бөлме жасалғанда
socket.on("roomCreated", data => {
  roomDiv.innerHTML = "";
  // екі ойыншы бір-біріне қарама-қарсы орналастырылады
  data.players.forEach((p, i) => {
    const div = document.createElement("div");
    div.classList.add("player");
    div.textContent = p.player.username;
    if(i === 0) div.style.transform = "rotate(180deg)"; // бірін бұру
    roomDiv.appendChild(div);
  });
});
