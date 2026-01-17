
// Telegram MiniApp деректері
const tgUser = window.Telegram.WebApp.initDataUnsafe?.user || {};
const tgId = tgUser.id || "unknown";

// Элементтерге көрсету
document.getElementById("tgId").textContent = tgId;

// Алғашқы баланс (0), кейін серверден алады
document.getElementById("balance").textContent = 0;

async function loadBalance() {
  if(!tgId) return;

  try {
    const res = await fetch("https://azionline.onrender.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramId: tgId })
    });

    const data = await res.json();
    if(data.balance !== undefined){
      document.getElementById("balance").textContent = data.balance;
    }
  } catch(e) {
    console.log("Серверге қосыла алмады", e);
  }
}

// Миниап жүктелгенде баланс алу
window.addEventListener("load", loadBalance);

// Играть батырмасы
document.getElementById("playButton").addEventListener("click", () => {
  alert("Ойын басталады!"); // Қазіргі уақытта тек демо
});
