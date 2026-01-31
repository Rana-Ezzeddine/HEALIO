const express = require("express");
const cors = require("cors");
require("dotenv").config();

const profileRoutes = require("./routes/profileRoutes");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.status(200).send("HEALIO backend is running ✅");
});

// US5 routes
app.use("/profile", profileRoutes);

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});