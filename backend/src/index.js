/** require("dotenv").config();
const connectDB = require("./config/db");

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
}); **/

// Load environment variables FIRST
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

console.log("ENV loaded. Has MONGO_URI?", !!process.env.MONGO_URI);

// Core imports
const express = require("express");
const cors = require("cors");

// Database
const connectDB = require("./config/db");

// Routes
const profileRoutes = require("./routes/profileRoutes");
const symptomsRoutes = require("./routes/symptoms.routes");

const app = express();

/////////////////////////////////////////////////
// ✅ Middlewares
/////////////////////////////////////////////////
app.use(cors());
app.use(express.json());

/////////////////////////////////////////////////
// ✅ Health / Test Route
/////////////////////////////////////////////////
app.get("/", (req, res) => {
  res.status(200).send("HEALIO backend is running ✅");
});

/////////////////////////////////////////////////
// ✅ API Routes
/////////////////////////////////////////////////
app.use("/profile", profileRoutes);
app.use("/symptoms", symptomsRoutes);

/////////////////////////////////////////////////
// ✅ Start Server ONLY after DB connects
/////////////////////////////////////////////////
const PORT = process.env.PORT || 5050;

console.log("About to connect DB...");
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
