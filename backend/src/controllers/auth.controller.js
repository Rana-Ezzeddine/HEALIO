const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const User = require("../models/User");

function isStrongPassword(pw) {
  return (
    typeof pw === "string" &&
    pw.length >= 10 &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /[0-9]/.test(pw)
  );
}

const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (!validator.isEmail(String(email))) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: "Password must be 10+ chars and include uppercase, lowercase, and a number.",
      });
    }

    const cleanEmail = String(email || "").toLowerCase().trim();

    // light UX pre-check
    const existing = await User.exists({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      email: cleanEmail,
      passwordHash,
      role: "patient",
      isVerified: false,
    });

    return res.status(201).json({
      message: "Registered successfully. Please verify your email.",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: "Email already registered." });
    }
    console.error(err);
    return res.status(500).json({ message: "Server error during registration." });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (!validator.isEmail(String(email))) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    const cleanEmail = String(email || "").toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail }).select("+passwordHash");
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
      { sub: user._id.toString(), role: user.role, isVerified: user.isVerified },
      secret,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" }
    );

    return res.json({
      token,
      user: {
        id: user._id,
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

module.exports = { register, login };

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("email role isVerified createdAt");
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error." });
  }
};
    

module.exports = { register, login, me };