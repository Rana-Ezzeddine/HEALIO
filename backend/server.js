/////////////////////////////////////////////////
// Load environment variables FIRST
/////////////////////////////////////////////////
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import sequelize, { testConnection } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, ".env"),
});



/////////////////////////////////////////////////
// Fail-fast env validation (production habit)
/////////////////////////////////////////////////
const requiredEnv = ["DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_ACCESS_SECRET"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

/////////////////////////////////////////////////
// Core Imports
/////////////////////////////////////////////////
import express from "express";
import cors from "cors";

// Sequelize connection (NO sync)
import sequelize, { testConnection } from "./database.js";

// Register models and associations
import "./src/models/index.js";

// Routes
import authRoutes from "./src/routes/auth.routes.js";
import profileRoutes from "./src/routes/profileRoutes.js";
import symptomsRoutes from "./src/routes/symptoms.routes.js";
import medicationRoutes from "./src/routes/medications.routes.js";
import doctorRoutes from "./src/routes/doctor.routes.js";
import medicalHistoryRoutes from "./src/routes/medicalHistory.routes.js";
/////////////////////////////////////////////////
// Initialize App
/////////////////////////////////////////////////
const app = express();
const PORT = process.env.PORT || 5050;

/////////////////////////////////////////////////
// Middlewares
/////////////////////////////////////////////////
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Development request logging
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  }
  next();
});

/////////////////////////////////////////////////
// Health Route
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
// API Routes
/////////////////////////////////////////////////
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/symptoms", symptomsRoutes);
app.use("/api/medications", medicationRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/medical-history", medicalHistoryRoutes)


/////////////////////////////////////////////////
// 404 Handler
/////////////////////////////////////////////////
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/////////////////////////////////////////////////
// Error Handler
/////////////////////////////////////////////////
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

/////////////////////////////////////////////////
// Initialize PostgreSQL & Start Server
/////////////////////////////////////////////////
const startServer = async () => {
  try {
    // Test database connection
    const connected = await testConnection();

    if (!connected) {
      throw new Error("PostgreSQL connection failed");
    }

    console.log("✓ PostgreSQL connected");

    /////////////////////////////////////////////////////////
    // Check if migrations were applied (SequelizeMeta exists)
    /////////////////////////////////////////////////////////
    const [result] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'SequelizeMeta'
      ) AS "exists";
    `);

    if (!result[0].exists) {
      console.log("⚠️  Database tables not found. Run: npm run db:migrate");
    } else {
      console.log("✓ Migrations detected (database schema ready)");
    }

    /////////////////////////////////////////////////////////
    // Start Express server
    /////////////////////////////////////////////////////////
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
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

/////////////////////////////////////////////////
// Graceful Shutdown
/////////////////////////////////////////////////
const shutdown = async () => {
  console.log("\nShutting down gracefully...");


  try {
    await sequelize.close();
    console.log("PostgreSQL connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error.message);
    process.exit(1);
  }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;
