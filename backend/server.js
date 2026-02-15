/////////////////////////////////////////////////
// ✅ Load environment variables FIRST
/////////////////////////////////////////////////
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(path.resolve(), ".env") });

/////////////////////////////////////////////////
// ✅ Fail-fast env validation (production habit)
/////////////////////////////////////////////////
const requiredEnv = ["DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_ACCESS_SECRET"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

/////////////////////////////////////////////////
// ✅ Core Imports
/////////////////////////////////////////////////
import express from "express";
import cors from "cors";

// Sequelize (PostgreSQL) - Connection only, NO sync()
import sequelize, { testConnection } from "./database.js";

// Import models to register associations
import './src/models/index.js';

// Routes
import authRoutes from "./src/routes/auth.routes.js";
import profileRoutes from "./src/routes/profileRoutes.js";
import symptomsRoutes from "./src/routes/symptoms.routes.js";
import medicationRoutes from "./src/routes/medications.routes.js";

/////////////////////////////////////////////////
// ✅ Initialize App
/////////////////////////////////////////////////
const app = express();
const PORT = process.env.PORT || 5050;

/////////////////////////////////////////////////
// ✅ Middlewares
/////////////////////////////////////////////////
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware (only in development)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  }
  next();
});

/////////////////////////////////////////////////
// ✅ Health Route
/////////////////////////////////////////////////
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "healio-backend",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/////////////////////////////////////////////////
// ✅ API Routes
/////////////////////////////////////////////////
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/symptoms", symptomsRoutes);
app.use("/api/medications", medicationRoutes);

/////////////////////////////////////////////////
// ✅ 404 handler
/////////////////////////////////////////////////
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/////////////////////////////////////////////////
// ✅ Error handler
/////////////////////////////////////////////////
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

/////////////////////////////////////////////////
// ✅ Initialize PostgreSQL & Start Server
// NOTE: NO sequelize.sync() - use migrations instead!
/////////////////////////////////////////////////
const startServer = async () => {
  try {
    // Test database connection
    const connected = await testConnection();
    if (!connected) throw new Error("PostgreSQL connection failed");

    console.log("✓ PostgreSQL connected");
    console.log("⚠️  Run 'npm run db:migrate' to set up database tables");

    // Start Express server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════╗
║   HEALIO Backend Server Running      ║
║   Port: ${PORT.toString().padEnd(30)}║
║   Environment: ${(process.env.NODE_ENV || "development").padEnd(23)}║
║   Database: PostgreSQL                ║
╚═══════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

/////////////////////////////////////////////////
// ✅ Graceful Shutdown
/////////////////////////////////////////////////
const shutdown = async () => {
  console.log("\nShutting down gracefully...");
  try {
    await sequelize.close();
    console.log("PostgreSQL connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;
