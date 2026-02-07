const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// simple strong password check
function isStrongPassword(pw) {
  return (
    typeof pw === "string" &&
    pw.length >= 8 &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /[0-9]/.test(pw)
  );
}

const register = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // 1) validate
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: "Password must be 8+ chars and include uppercase, lowercase, and a number.",
      });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    // 2) block duplicates
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    // 3) hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 4) create user in DB
    await User.create({
      email: cleanEmail,
      password: passwordHash,   // stored hashed
      role: role || "patient",
      isVerified: false,
    });

    return res.status(201).json({ message: "Registered successfully. Please verify your email." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error during registration." });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) validate
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    // 2) find user
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // 3) check password
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // 4) (later) block if not verified
    // if (!user.isVerified) return res.status(403).json({ message: "Verify your email first." });

    // 5) issue JWT
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "JWT_SECRET missing in .env" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      role: user.role,
      message: "Login successful",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error during login." });
  }
};

module.exports = { register, login };
