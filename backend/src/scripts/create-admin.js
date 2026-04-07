import "dotenv/config";
import bcrypt from "bcrypt";
import sequelize from "../../database.js";
import User from "../models/User.js";
import PatientProfile from "../models/PatientProfile.js";

async function main() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  const password = String(process.argv[3] || "").trim();
  const firstName = String(process.argv[4] || "Platform").trim();
  const lastName = String(process.argv[5] || "Admin").trim();

  if (!email || !password) {
    throw new Error("Usage: node src/scripts/create-admin.js <email> <password> [firstName] [lastName]");
  }

  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters.");
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new Error(`User already exists for ${email}`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email,
    passwordHash,
    role: "admin",
    isVerified: true,
    authProvider: "local",
    doctorApprovalStatus: "not_applicable",
  });

  await PatientProfile.create({
    userId: user.id,
    firstName,
    lastName,
    email,
  });

  console.log(`Created admin ${email}`);
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err.message || err);
  try {
    await sequelize.close();
  } catch {}
  process.exit(1);
});
