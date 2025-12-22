const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let waitingPlayer = null;
let currentGame = null;

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // ===== JOIN =====
  socket.on("joinGame", ({ userId }) => {
    if (!waitingPlayer) {
      waitingPlayer = { socket, userId };
      socket.emit("youAreFirst");
    } else {
      const first = waitingPlayer;
      waitingPlayer = null;

      currentGame = {
        starter: {
          socketId: first.socket.id,
          userId: first.userId,
          bet: null
        },
        responder: {
          socketId: socket.id,
          userId,
          bet: null
        }
      };

      first.socket.emit("opponentFound", { role: "starter" });
      socket.emit("opponentFound", { role: "responder" });
    }
  });

  // ===== 1-ОЙЫНШЫ СТАВКА =====
  socket.on("starterBet", ({ bet }) => {
    if (!currentGame) return;
    if (socket.id !== currentGame.starter.socketId) return;

    currentGame.starter.bet = bet;

    io.to(currentGame.responder.socketId).emit("responderBet", {
      bet: bet * 2
    });
  });

  // ===== 2-ОЙЫНШЫ ГОТОВ / ОТБОЙ =====
  socket.on("responderDecision", ({ decision }) => {
    if (!currentGame) return;
    if (socket.id !== currentGame.responder.socketId) return;

    io.to(currentGame.starter.socketId).emit("responderDecision", {
      decision
    });

    if (decision === "отбой") {
      currentGame = null;
    }
  });

  // ===== DISCONNECT =====
  socket.on("disconnect", () => {
    if (waitingPlayer && waitingPlayer.socket.id === socket.id) {
      waitingPlayer = null;
    }

    if (
      currentGame &&
      (socket.id === currentGame.starter.socketId ||
        socket.id === currentGame.responder.socketId)
    ) {
      currentGame = null;
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
