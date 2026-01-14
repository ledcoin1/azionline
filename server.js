const express = require("express");

const app = express();            //kitaphanalar

const http = require("http").createServer(app);

const io = require("socket.io")(http);

const PORT = process.env.PORT || 3000;
;
//frontend papka
app.use(express.static("public"));

// massiv
let players={};

//miniapp ashkanda
io.on("connection",socket=>{
  console.log("ал кірді: ",socket.id);

  socket.on("playerJoined",players=>{
    players[socket.id]=players;

    console.log("осындай ойыншы кірді ",player);
    console.log("қазіргі ойыншылар ",players);
  })
})




http.listen(PORT, () => {
    console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});





