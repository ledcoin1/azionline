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

