/////////////////////////////////////////////////
// ✅ Load environment variables FIRST
/////////////////////////////////////////////////
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



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

// Database
import sequelize, { testConnection } from "../database.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
import profileRoutes from "./routes/profileRoutes.js";
import symptomsRoutes from "./routes/symptoms.routes.js";
import medicationsRoutes from "./routes/medications.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import appointmentsRoutes from "./routes/appointments.routes.js";
import caregiverRoutes from "./routes/caregiver.routes.js";

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
app.use("/api/medications", medicationsRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/caregivers", caregiverRoutes);

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

const startServer = async () => {
  try {
    const connected = await testConnection();
    if (!connected) throw new Error("PostgreSQL connection failed");

    // Auto-sync Sequelize models
    await sequelize.sync({ alter: true });
    console.log("✅ PostgreSQL models synchronized");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
