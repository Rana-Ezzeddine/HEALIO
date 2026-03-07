import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import User from '../models/User.js';

const isValidName = (name) => {
  return (
    typeof name === "string" &&
    /^[A-Za-z]+$/.test(name.trim()) &&
    name.trim().length >= 2
  );
};

const isStrongPassword = (pw) => {
  return (
    typeof pw === "string" &&
    pw.length >= 10 &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /[0-9]/.test(pw)
  );
}

export const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: "First name, last name, email, and password are required.",
      });
    }

    if (!isValidName(firstName)) {
      return res.status(400).json({
        message: "First name must be at least 2 characters and contain letters only.",
      });
    }

    if (!isValidName(lastName)) {
      return res.status(400).json({
        message: "Last name must be at least 2 characters and contain letters only.",
      });
    }

    if (!validator.isEmail(String(email))) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: "Password must be 10+ chars and include uppercase, lowercase, and a number.",
      });
    }

    const validRoles = ["patient", "doctor", "caregiver"];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const userRole = role;

    const cleanEmail = String(email || "").toLowerCase().trim();

    // Check if user already exists
    const existing = await User.findOne({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      email: cleanEmail,
      passwordHash,
      role: userRole,
      isVerified: false,
    });

    return res.status(201).json({
      message: "Registered successfully. Please verify your email.",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: "Email already registered." });
    }
    console.error(err);
    return res.status(500).json({ message: "Server error during registration." });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (!validator.isEmail(String(email))) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    const cleanEmail = String(email || "").toLowerCase().trim();

    const user = await User.scope('withPassword').findOne({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "Server misconfigured." });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role, isVerified: user.isVerified },
      secret,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      message: "Login successful",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error during login." });
  }
};

export const me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'role', 'isVerified', 'createdAt']
    });
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error." });
  }
};
