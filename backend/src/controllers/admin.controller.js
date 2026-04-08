import bcrypt from "bcrypt";
import User from "../models/User.js";
import PatientProfile from "../models/PatientProfile.js";

function buildDisplayName(user, profile) {
  return [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || user.email;
}

export const listAdminAccounts = async (_req, res) => {
  try {
    const users = await User.findAll({
      where: { role: "admin" },
      order: [["createdAt", "DESC"]],
      attributes: [
        "id",
        "email",
        "role",
        "isVerified",
        "createdAt",
        "updatedAt",
      ],
    });

    const profiles = await PatientProfile.findAll({
      where: { userId: users.map((user) => user.id) },
      attributes: ["userId", "firstName", "lastName"],
    });
    const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]));

    return res.json({
      users: users.map((user) => {
        const profile = profileMap.get(user.id);
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          firstName: profile?.firstName || null,
          lastName: profile?.lastName || null,
          displayName: buildDisplayName(user, profile),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      }),
    });
  } catch (err) {
    console.error("listAdminAccounts error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

export const createAdminAccount = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();
    const firstName = String(req.body?.firstName || "Platform").trim();
    const lastName = String(req.body?.lastName || "Admin").trim();

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    if (password.length < 10) {
      return res.status(400).json({ message: "Password must be at least 10 characters." });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "A user with this email already exists." });
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

    return res.status(201).json({
      message: "Admin account created.",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        firstName,
        lastName,
        displayName: buildDisplayName(user, { firstName, lastName }),
      },
    });
  } catch (err) {
    console.error("createAdminAccount error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};
