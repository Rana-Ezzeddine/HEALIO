const express = require("express");
const cors = require("cors");
require("dotenv").config();

const symptomsRoutes = require("./routes/symptoms.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("HEALIO backend is running ✅");
});

app.use("/symptoms", symptomsRoutes);

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
