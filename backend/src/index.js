const express = require("express");
require("dotenv").config();

const app = express();

app.get("/", (req, res) => {
  res.status(200).send("HEALIO backend is running ✅");
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
