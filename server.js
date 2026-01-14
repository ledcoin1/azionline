const { Socket } = require("dgram");

const express = require(express);
const app = express();            //kitaphanalar
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const PORT = procecess.env.PORT || 3000;

//frontend papka
app.use(express.static("public"));

// massiv
let players={};

//miniapp ashkanda
io.on("connection",Socket=>{
  console.log("ал кірді: ",socket.id);
})
http.listen(PORT, () => {
    console.log(`Server ${PORT} портында жұмыс істеп тұр`);
});
