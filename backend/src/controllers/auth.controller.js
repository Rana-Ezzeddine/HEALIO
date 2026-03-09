import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import crypto from 'crypto';
import User from '../models/User.js';
import EmailVerificationToken from '../models/EmailVerificationToken.js';
import { sendVerificationEmail } from '../services/mail.service.js';

const EMAIL_TOKEN_TTL_MS = Number(process.env.EMAIL_VERIFICATION_TTL_MS || 86400000);

const isValidName = (name) => {
  return (
    typeof name === 'string' &&
    /^[A-Za-z]+$/.test(name.trim()) &&
    name.trim().length >= 2
  );
};

const isStrongPassword = (pw) => {
  return (
    typeof pw === 'string' &&
    pw.length >= 10 &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /[0-9]/.test(pw)
  );
};

const issueAccessToken = (user) => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('Server misconfigured.');

  return jwt.sign(
    { sub: user.id, role: user.role, isVerified: user.isVerified },
    secret,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

const createVerificationToken = async (userId) => {
  await EmailVerificationToken.destroy({ where: { userId, usedAt: null } });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await EmailVerificationToken.create({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
  });

  return rawToken;
};

export const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: 'First name, last name, email, and password are required.',
      });
    }

    if (!isValidName(firstName)) {
      return res.status(400).json({
        message: 'First name must be at least 2 characters and contain letters only.',
      });
    }

    if (!isValidName(lastName)) {
      return res.status(400).json({
        message: 'Last name must be at least 2 characters and contain letters only.',
      });
    }

    if (!validator.isEmail(String(email))) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: 'Password must be 10+ chars and include uppercase, lowercase, and a number.',
      });
    }

    const validRoles = ["patient", "doctor", "caregiver"];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const userRole = role;

    const cleanEmail = String(email || "").toLowerCase().trim();

    const existing = await User.findOne({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      email: cleanEmail,
      passwordHash,
      role: userRole,
      isVerified: false,
    });

    const rawToken = await createVerificationToken(user.id);
    await sendVerificationEmail({ to: user.email, token: rawToken });

    return res.status(201).json({
      message: 'Registered successfully. Please verify your email.',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      ...(process.env.NODE_ENV === 'test' ? { verificationToken: rawToken } : {}),
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Email already registered.' });
    }
    console.error(err);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const rawToken = String(req.body?.token || req.query?.token || '').trim();
    if (!rawToken) {
      return res.status(400).json({ message: 'Verification token is required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenRow = await EmailVerificationToken.findOne({ where: { tokenHash } });

    if (!tokenRow) {
      return res.status(400).json({ message: 'Invalid verification token.' });
    }

    if (tokenRow.usedAt) {
      return res.status(400).json({ message: 'Token already used.' });
    }

    if (new Date(tokenRow.expiresAt) < new Date()) {
      return res.status(400).json({ message: 'Token expired.' });
    }

    const user = await User.findByPk(tokenRow.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.isVerified = true;
    await user.save();

    tokenRow.usedAt = new Date();
    await tokenRow.save();

    await EmailVerificationToken.update(
      { usedAt: new Date() },
      { where: { userId: user.id, usedAt: null } }
    );

    const token = issueAccessToken(user);

    return res.status(200).json({
      message: 'Email verified successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while verifying email.' });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email already verified.' });
    }

    const rawToken = await createVerificationToken(user.id);
    await sendVerificationEmail({ to: user.email, token: rawToken });

    return res.status(200).json({
      message: 'Verification email sent.',
      ...(process.env.NODE_ENV === 'test' ? { verificationToken: rawToken } : {}),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while resending verification email.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (!validator.isEmail(String(email))) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    const cleanEmail = String(email || '').toLowerCase().trim();

    const user = await User.scope('withPassword').findOne({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in.',
      });
    }

    const token = issueAccessToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      message: 'Login successful',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error during login.' });
  }
};

export const me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'role', 'isVerified', 'createdAt'],
    });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
};
