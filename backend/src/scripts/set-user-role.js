import "dotenv/config";
import sequelize from "../../database.js";
import User from "../models/User.js";
import PatientProfile from "../models/PatientProfile.js";

async function main() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  const role = String(process.argv[3] || "").trim().toLowerCase();

  if (!email || !role) {
    throw new Error('Usage: node src/scripts/set-user-role.js <email> <role>');
  }

  const allowedRoles = new Set(["patient", "doctor", "caregiver", "admin"]);
  if (!allowedRoles.has(role)) {
    throw new Error(`Unsupported role "${role}".`);
  }

  const user = await User.scope("withPassword").findOne({ where: { email } });
  if (!user) {
    throw new Error(`User not found for ${email}`);
  }

  await user.update({
    role,
    isVerified: role === "admin" ? true : user.isVerified,
    doctorApprovalStatus: role === "doctor" ? user.doctorApprovalStatus : "not_applicable",
    doctorApprovalNotes: role === "doctor" ? user.doctorApprovalNotes : null,
    doctorApprovalRequestedInfoAt: role === "doctor" ? user.doctorApprovalRequestedInfoAt : null,
    doctorApprovalReviewedAt: role === "doctor" ? user.doctorApprovalReviewedAt : null,
  });

  const profile = await PatientProfile.findOne({ where: { userId: user.id } });
  if (!profile) {
    await PatientProfile.create({
      userId: user.id,
      firstName: role === "admin" ? "Platform" : "User",
      lastName: role === "admin" ? "Admin" : "Profile",
      email: user.email,
    });
  }

  console.log(`Updated ${user.email} to role ${role}${role === "admin" ? " and marked the account verified" : ""}`);
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err.message || err);
  try {
    await sequelize.close();
  } catch {}
  process.exit(1);
});
