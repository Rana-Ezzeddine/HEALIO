/////////////////////////////////////////////////
// ✅ Load environment variables FIRST
/////////////////////////////////////////////////
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

/////////////////////////////////////////////////
// ✅ Fail-fast env validation (production habit)
/////////////////////////////////////////////////
const requiredEnv = ["MONGO_URI", "JWT_ACCESS_SECRET"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

/////////////////////////////////////////////////
// ✅ Core Imports
/////////////////////////////////////////////////
const express = require("express");
const cors = require("cors");

// Database
const connectDB = require("./config/db");

// Routes
const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profileRoutes");
const symptomsRoutes = require("./routes/symptoms.routes");

/////////////////////////////////////////////////
// ✅ Initialize App
/////////////////////////////////////////////////
const app = express();

/////////////////////////////////////////////////
// ✅ Middlewares
/////////////////////////////////////////////////

// CORS: lock this down later to your frontend origin
app.use(
  cors({
    origin: true, // ok for dev; in prod set to your frontend URL
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" })); // basic hardening

/////////////////////////////////////////////////
// ✅ Health Route
/////////////////////////////////////////////////
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "healio-backend" });
});

/////////////////////////////////////////////////
// ✅ API Routes (use a consistent prefix)
/////////////////////////////////////////////////
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/symptoms", symptomsRoutes);

/////////////////////////////////////////////////
// ✅ Global error handler (minimal but important)
/////////////////////////////////////////////////
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

/////////////////////////////////////////////////
// ✅ Start Server ONLY after DB connects
/////////////////////////////////////////////////
const PORT = process.env.PORT || 5050;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
