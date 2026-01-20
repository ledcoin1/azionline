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


const socket = io();

socket.on("connect", ()=>{
  console.log("Socket қосылды:", socket.id);
});
