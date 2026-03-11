import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import crypto from 'crypto';
import { Op } from 'sequelize';
import User from '../models/User.js';
import PatientProfile from '../models/PatientProfile.js';
import PendingRegistration from '../models/PendingRegistration.js';
import { sendVerificationEmail } from '../services/mail.service.js';

const EMAIL_TOKEN_TTL_MS = Number(process.env.EMAIL_VERIFICATION_TTL_MS || 86400000);
const EMAIL_VERIFICATION_DISABLED = /^true$/i.test(process.env.DISABLE_EMAIL_VERIFICATION || '');

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

const createVerificationToken = async () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return rawToken;
};

const buildAuthUser = async (user) => {
  const profile = await PatientProfile.findOne({
    where: { userId: user.id },
    attributes: ['firstName', 'lastName'],
  });

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    firstName: profile?.firstName || null,
    lastName: profile?.lastName || null,
  };
};

const createVerifiedUserWithProfile = async ({ firstName, lastName, email, passwordHash, role }) => {
  const user = await User.create({
    email,
    passwordHash,
    role,
    isVerified: true,
  });

  await PatientProfile.upsert({
    userId: user.id,
    firstName,
    lastName,
    email,
  });

  return user;
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
    await PendingRegistration.destroy({
      where: {
        email: cleanEmail,
        expiresAt: { [Op.lt]: new Date() },
      },
    });

    const [existingUser, existingPending] = await Promise.all([
      User.findOne({ where: { email: cleanEmail } }),
      PendingRegistration.findOne({ where: { email: cleanEmail } }),
    ]);
    if (existingUser || existingPending) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    if (EMAIL_VERIFICATION_DISABLED) {
      const user = await createVerifiedUserWithProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: cleanEmail,
        passwordHash,
        role: userRole,
      });
      const token = issueAccessToken(user);
      const authUser = await buildAuthUser(user);

      return res.status(201).json({
        message: 'Registered successfully. Email verification is disabled for local testing.',
        token,
        user: authUser,
      });
    }

    const rawToken = await createVerificationToken();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    try {
      await PendingRegistration.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: cleanEmail,
        passwordHash,
        role: userRole,
        tokenHash,
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      });
      await sendVerificationEmail({ to: cleanEmail, token: rawToken });

      return res.status(201).json({
        message: 'Registered successfully. Please verify your email.',
        ...(process.env.NODE_ENV === 'test' ? { verificationToken: rawToken } : {}),
      });
    } catch (mailErr) {
      await PendingRegistration.destroy({ where: { email: cleanEmail } });

      if (mailErr.message === 'SMTP_NOT_CONFIGURED') {
        return res.status(503).json({
          message: 'Email verification is not configured on the server. Add SMTP settings before allowing signup.',
        });
      }

      console.error(mailErr);
      return res.status(502).json({
        message: 'Failed to send verification email. Please try again later.',
      });
    }
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
    const pendingRegistration = await PendingRegistration.findOne({ where: { tokenHash } });

    if (!pendingRegistration) {
      return res.status(400).json({ message: 'Invalid verification token.' });
    }

    if (new Date(pendingRegistration.expiresAt) < new Date()) {
      await PendingRegistration.destroy({ where: { id: pendingRegistration.id } });
      return res.status(400).json({ message: 'Token expired.' });
    }

    const existingUser = await User.findOne({ where: { email: pendingRegistration.email } });
    if (existingUser) {
      await PendingRegistration.destroy({ where: { id: pendingRegistration.id } });
      return res.status(409).json({ message: 'Email already registered.' });
    }

    let user;
    try {
      user = await User.create({
        email: pendingRegistration.email,
        passwordHash: pendingRegistration.passwordHash,
        role: pendingRegistration.role,
        isVerified: true,
      });
    } catch (createErr) {
      if (createErr.name !== 'SequelizeUniqueConstraintError') {
        throw createErr;
      }

      const existingVerifiedUser = await User.findOne({ where: { email: pendingRegistration.email } });
      if (!existingVerifiedUser) {
        throw createErr;
      }
      user = existingVerifiedUser;
    }

    await PatientProfile.upsert({
      userId: user.id,
      firstName: pendingRegistration.firstName,
      lastName: pendingRegistration.lastName,
      email: pendingRegistration.email,
    });
    await PendingRegistration.destroy({ where: { id: pendingRegistration.id } });

    const token = issueAccessToken(user);
    const authUser = await buildAuthUser(user);

    return res.status(200).json({
      message: 'Email verified successfully.',
      token,
      user: authUser,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while verifying email.' });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const cleanEmail = String(req.body?.email || '').toLowerCase().trim();
    if (!validator.isEmail(cleanEmail)) {
      return res.status(400).json({ message: 'Valid email is required.' });
    }

    const pendingRegistration = await PendingRegistration.findOne({ where: { email: cleanEmail } });
    if (!pendingRegistration) {
      return res.status(404).json({ message: 'No pending registration found for this email.' });
    }

    const rawToken = await createVerificationToken();
    pendingRegistration.tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    pendingRegistration.expiresAt = new Date(Date.now() + EMAIL_TOKEN_TTL_MS);
    await pendingRegistration.save();
    await sendVerificationEmail({ to: pendingRegistration.email, token: rawToken });

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

    if (!EMAIL_VERIFICATION_DISABLED && !user.isVerified) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in.',
      });
    }

    const token = issueAccessToken(user);
    const authUser = await buildAuthUser(user);

    return res.json({
      token,
      user: authUser,
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
    const authUser = await buildAuthUser(user);
    return res.json({ user: { ...authUser, createdAt: user.createdAt } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
};
