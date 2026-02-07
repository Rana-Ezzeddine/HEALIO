const express = require("express");
const cors = require("cors");
require("dotenv").config();

const profileRoutes = require("./routes/profileRoutes");
const symptomsRoutes = require("./routes/symptoms.routes");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.status(200).send("HEALIO backend is running ✅");
});

// Routes
app.use("/profile", profileRoutes);
app.use("/symptoms", symptomsRoutes);

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
