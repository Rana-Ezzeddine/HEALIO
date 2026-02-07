/////////////////////////////////////////////////
// ✅ Load environment variables FIRST
/////////////////////////////////////////////////
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

console.log("ENV loaded. Has MONGO_URI?", !!process.env.MONGO_URI);

/////////////////////////////////////////////////
// ✅ Core Imports
/////////////////////////////////////////////////
const express = require("express");
const cors = require("cors");

// Database
const connectDB = require("./config/db");

// Routes  ⭐⭐⭐ ALL ROUTES MUST BE HERE
const authRoutes = require("./routes/auth.routes.js");
const profileRoutes = require("./routes/profileRoutes");
const symptomsRoutes = require("./routes/symptoms.routes");

/////////////////////////////////////////////////
// ✅ Initialize App
/////////////////////////////////////////////////
const app = express();

/////////////////////////////////////////////////
// ✅ Middlewares
/////////////////////////////////////////////////
app.use(cors());
app.use(express.json());

/////////////////////////////////////////////////
// ✅ Health Route
/////////////////////////////////////////////////
app.get("/", (req, res) => {
  res.status(200).send("HEALIO backend is running ✅");
});

console.log("authRoutes type:", typeof authRoutes);
console.log("profileRoutes type:", typeof profileRoutes);
console.log("symptomsRoutes type:", typeof symptomsRoutes);

/////////////////////////////////////////////////
// ✅ API Routes
/////////////////////////////////////////////////
app.use("/auth", authRoutes);
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
