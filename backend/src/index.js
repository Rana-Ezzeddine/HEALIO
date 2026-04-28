/////////////////////////////////////////////////
// ✅ Load environment variables FIRST
/////////////////////////////////////////////////
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/////////////////////////////////////////////////
// ✅ Fail-fast env validation
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
import caregiverInviteRoutes from "./routes/caregiverInvite.routes.js";
import caregiverNotesRoutes from "./routes/caregiverNotes.routes.js";
import caregiverActionsRoutes from "./routes/caregiverActions.routes.js";
import doctorNotesRoutes from "./routes/doctorNotes.routes.js";

/////////////////////////////////////////////////
// ✅ Initialize App
/////////////////////////////////////////////////
const app = express();

async function startNgrokTunnel(port) {
  if (process.env.ENABLE_NGROK !== "true") return;

  try {
    const { default: ngrok } = await import("@ngrok/ngrok");
    const listener = await ngrok.connect({
      addr: port,
      authtoken_from_env: true,
    });

    const publicUrl = listener.url();

    console.log(`🌍 Ngrok public URL: ${publicUrl}`);
    console.log(`🔗 Health check: ${publicUrl}/health`);
    console.log(`🔐 Verification base URL: ${publicUrl}`);
    console.log(
      `✅ Put this in your .env for email verification:\nAPP_BASE_URL=${publicUrl}`
    );
  } catch (ngrokError) {
    console.error("❌ Failed to start ngrok:", ngrokError);
  }
}

/////////////////////////////////////////////////
// ✅ Middlewares
/////////////////////////////////////////////////
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

/////////////////////////////////////////////////
// ✅ Health Route
/////////////////////////////////////////////////
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "healio-backend" });
});

/////////////////////////////////////////////////
// ✅ API Routes
/////////////////////////////////////////////////
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/symptoms", symptomsRoutes);
app.use("/api/medications", medicationsRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/caregivers", caregiverRoutes);
app.use("/api/caregiver-invites", caregiverInviteRoutes);
app.use("/api/caregiver-notes", caregiverNotesRoutes);
app.use("/api/caregiver-actions", caregiverActionsRoutes);
app.use("/api/doctor-notes", doctorNotesRoutes);

/////////////////////////////////////////////////
// ✅ Global error handler
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
    if (!connected) throw new Error("PostgreSQL connection failed");    const [result] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'SequelizeMeta'
      ) AS "exists";
    `);

    if (!result[0].exists) {
      console.log("Database tables not found. Run: npm run db:migrate");
    } else {
      console.log("Migrations detected (database schema ready)");
    }

    app.listen(PORT, async () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);

      // ✅ Start ngrok only if enabled
      await startNgrokTunnel(PORT);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

