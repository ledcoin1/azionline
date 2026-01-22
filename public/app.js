const tg = window.Telegram.WebApp;
tg.expand();

// Telegram user
const user = tg.initDataUnsafe.user;

if(!user){
  alert("Telegram арқылы кір!");
}

// ID алу
const telegramId = user.id;
uid.innerText = telegramId;

// backend login
fetch("/api/login",{
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body:JSON.stringify({ telegramId })
})
.then(r=>r.json())
.then(data=>{
  bal.innerText = data.balance;
});


// Socket қосылғанын тексердік
const socket = io();

socket.on("connect", ()=>{
  console.log("Socket қосылды:", socket.id);
});

// Играть батырмасына listener қосамыз
document.getElementById("igrat").onclick = () => {
  // серверге сигнал жібереміз
  socket.emit("play_click", { telegramId: uid.innerText });

  console.log("Играть батырмасы басылды, сигнал жіберілді");
};

socket.on("joined_room", (data) => {
  const roomId = data.roomId;
  const players = data.players;

  // Егер room бұрын жасалмаған болса — контейнер жасау
  let roomDiv = document.getElementById(roomId);
  if(!roomDiv){
    roomDiv = document.createElement("div");
    roomDiv.id = roomId;
    roomDiv.className = "room";
    roomDiv.innerHTML = `<h3>Room: ${roomId}</h3><ul class="players"></ul>`;
    document.body.appendChild(roomDiv);
  }

  // Players тізімін шығару
  const playersUl = roomDiv.querySelector(".players");
  playersUl.innerHTML = ""; // ескі тізімді тазалау
  players.forEach(p => {
    const li = document.createElement("li");
    li.innerText = `${p.telegramId} — ${p.status}`;
    playersUl.appendChild(li);
  });
});

