import bcrypt from "bcrypt";
import User from "../models/User.js";
import PatientProfile from "../models/PatientProfile.js";

const MANAGEABLE_ROLES = new Set(["patient", "caregiver", "admin"]);

function buildDisplayName(user, profile) {
  return [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || user.email;
}

export const listAdminAccounts = async (_req, res) => {
  try {
    const users = await User.findAll({
      where: {},
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

export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const nextRole = String(req.body?.role || "").trim().toLowerCase();

    if (!MANAGEABLE_ROLES.has(nextRole)) {
      return res.status(400).json({ message: "Invalid target role." });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (req.user?.id && user.id === req.user.id) {
      return res.status(400).json({ message: "Use a different admin account to change your own role." });
    }

    if (user.role === "admin") {
      return res.status(400).json({ message: "Admin users cannot be modified from this page." });
    }

    await user.update({
      role: nextRole,
      doctorApprovalStatus: nextRole === "doctor" ? user.doctorApprovalStatus : "not_applicable",
      doctorApprovalNotes: nextRole === "doctor" ? user.doctorApprovalNotes : null,
      doctorApprovalRequestedInfoAt: nextRole === "doctor" ? user.doctorApprovalRequestedInfoAt : null,
      doctorApprovalReviewedAt: nextRole === "doctor" ? user.doctorApprovalReviewedAt : null,
    });

    return res.json({
      message: "User role updated.",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("updateUserRole error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};
