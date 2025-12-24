const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

app.post("/api/hello", (req, res) => {
  console.log("Серверге келді:", req.body);

  res.json({
    ok: true,
    message: "Сервер жауап берді",
    data: req.body
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
