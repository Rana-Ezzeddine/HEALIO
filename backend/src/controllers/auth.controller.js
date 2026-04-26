import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import crypto from 'crypto';
import { createPublicKey } from 'crypto';
import { Op } from 'sequelize';
import User from '../models/User.js';
import PatientProfile from '../models/PatientProfile.js';
import PendingRegistration from '../models/PendingRegistration.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/mail.service.js';
import {
  buildMfaSetupPayload,
  createMfaChallengeToken,
  createMfaSetupToken,
  decryptMfaSecret,
  encryptMfaSecret,
  generateBackupCodes,
  generateTotpSecret,
  verifyBackupCode,
  verifyMfaChallengeToken,
  verifyMfaSetupToken,
  verifyTotpCode,
} from '../services/mfa.service.js';
import {
  DOCTOR_APPROVAL_STATUS,
  getDoctorApprovalStatusForNewUser,
  isDoctorRole,
} from '../lib/doctorApproval.js';

const EMAIL_TOKEN_TTL_MS = Number(process.env.EMAIL_VERIFICATION_TTL_MS || 86400000);
const PASSWORD_RESET_TTL_MS = Number(process.env.PASSWORD_RESET_TTL_MS || 3600000);
const EMAIL_VERIFICATION_DISABLED = /^true$/i.test(process.env.DISABLE_EMAIL_VERIFICATION || '');
const SOCIAL_STATE_TTL = process.env.SOCIAL_AUTH_STATE_EXPIRES_IN || '10m';
const SOCIAL_CALLBACK_PATH = '/social-auth-complete';
const VALID_ROLES = new Set(['patient', 'doctor', 'caregiver']);

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

const isValidName = (name) => {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  return /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/.test(trimmed) && trimmed.replace(/\s+/g, '').length >= 2;
};

const isStrongPassword = (pw) => (
  typeof pw === 'string' &&
  pw.length >= 10 &&
  /[A-Z]/.test(pw) &&
  /[a-z]/.test(pw) &&
  /[0-9]/.test(pw)
);

const normalizeDoctorLicense = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return { ok: false, message: 'Doctor license number is required.' };
  }

  if (normalized.length < 4 || normalized.length > 64) {
    return { ok: false, message: 'Doctor license number must be between 4 and 64 characters.' };
  }

  return { ok: true, value: normalized };
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

const assertLocalPasswordIfNeeded = async (user, password) => {
  if (user.authProvider !== 'local') return;

  if (!password) {
    const err = new Error('Current password is required.');
    err.status = 400;
    throw err;
  }

  const ok = await bcrypt.compare(String(password), user.passwordHash || '');
  if (!ok) {
    const err = new Error('Current password is incorrect.');
    err.status = 401;
    throw err;
  }
};

const buildMfaChallengeResponse = async (user, provider = 'local') => ({
  requiresTwoFactor: true,
  challengeToken: createMfaChallengeToken({ userId: user.id, provider }),
  user: await buildAuthUser(user),
  message: 'Two-factor authentication code required.',
});

const verifyMfaCodeForUser = async (user, code) => {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) {
    return { ok: false };
  }

  const encryptedSecret = user.mfaSecretEncrypted;
  if (encryptedSecret) {
    const secret = decryptMfaSecret(encryptedSecret);
    if (verifyTotpCode(secret, normalizedCode)) {
      return { ok: true, consumedBackupCode: false };
    }
  }

  const backupHashes = Array.isArray(user.mfaRecoveryCodeHashes) ? user.mfaRecoveryCodeHashes : [];
  if (backupHashes.length > 0) {
    const result = await verifyBackupCode(normalizedCode, backupHashes);
    if (result.ok) {
      await user.update({ mfaRecoveryCodeHashes: result.remainingHashes });
      return { ok: true, consumedBackupCode: true };
    }
  }

  return { ok: false };
};

const createVerificationToken = async () => crypto.randomBytes(32).toString('hex');
const createPasswordResetToken = async () => crypto.randomBytes(32).toString('hex');

const getFrontendBaseUrl = () => process.env.FRONTEND_URL || process.env.APP_BASE_URL || 'http://localhost:5173';

const getSocialCallbackUrl = () => `${getFrontendBaseUrl()}${SOCIAL_CALLBACK_PATH}`;

const buildCallbackQuery = (params) => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, value);
  }

  return search.toString();
};

const redirectToFrontend = (res, params) => {
  const callbackUrl = `${getSocialCallbackUrl()}?${buildCallbackQuery(params)}`;
  return res.redirect(callbackUrl);
};

const getSocialStateSecret = () => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('Server misconfigured.');
  return secret;
};

const createSocialState = ({ provider, role, intent }) => jwt.sign(
  {
    provider,
    role: VALID_ROLES.has(role) ? role : undefined,
    intent: intent === 'signup' ? 'signup' : 'login',
  },
  getSocialStateSecret(),
  { expiresIn: SOCIAL_STATE_TTL }
);

const verifySocialState = (state, provider) => {
  const payload = jwt.verify(String(state || ''), getSocialStateSecret());

  if (payload.provider !== provider) {
    throw new Error('Invalid social auth state.');
  }

  return payload;
};

const normalizeNameParts = ({ firstName, lastName, email, fallbackName }) => {
  const safeEmail = String(email || '').trim().toLowerCase();
  const normalizedFirstName = String(firstName || '').trim();
  const normalizedLastName = String(lastName || '').trim();

  if (normalizedFirstName && normalizedLastName) {
    return {
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
    };
  }

  const sourceName = String(fallbackName || '').trim();
  if (sourceName) {
    const parts = sourceName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return {
        firstName: normalizedFirstName || parts[0],
        lastName: normalizedLastName || parts.slice(1).join(' '),
      };
    }
    if (parts.length === 1) {
      return {
        firstName: normalizedFirstName || parts[0],
        lastName: normalizedLastName || 'User',
      };
    }
  }

  const emailLocalPart = safeEmail.split('@')[0] || 'healio';
  return {
    firstName: normalizedFirstName || emailLocalPart.slice(0, 1).toUpperCase() + emailLocalPart.slice(1),
    lastName: normalizedLastName || 'User',
  };
};

const buildAuthUser = async (user) => {
  const profile = await PatientProfile.findOne({
    where: { userId: user.id },
    attributes: ['firstName', 'lastName', 'licenseNb'],
  });

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    authProvider: user.authProvider,
    mfaEnabled: Boolean(user.mfaEnabled),
    firstName: profile?.firstName || null,
    lastName: profile?.lastName || null,
    licenseNb: profile?.licenseNb || null,
    doctorApprovalStatus: isDoctorRole(user.role) ? user.doctorApprovalStatus : DOCTOR_APPROVAL_STATUS.NOT_APPLICABLE,
    doctorApprovalNotes: isDoctorRole(user.role) ? user.doctorApprovalNotes || null : null,
    requestedMoreInfo: isDoctorRole(user.role) ? Boolean(user.doctorApprovalRequestedInfoAt) : false,
  };
};

const buildPendingAuthUser = ({ firstName, lastName, email, role, licenseNb = null }) => ({
  id: null,
  email,
  role,
  isVerified: false,
  authProvider: 'local',
  mfaEnabled: false,
  firstName,
  lastName,
  licenseNb,
  doctorApprovalStatus: isDoctorRole(role) ? DOCTOR_APPROVAL_STATUS.UNVERIFIED : DOCTOR_APPROVAL_STATUS.NOT_APPLICABLE,
  doctorApprovalNotes: null,
  requestedMoreInfo: false,
});

const createVerifiedUserWithProfile = async ({
  firstName,
  lastName,
  email,
  passwordHash = null,
  role,
  authProvider = 'local',
  providerSubject = null,
  doctorApprovalStatus = getDoctorApprovalStatusForNewUser({ role, isVerified: true }),
  licenseNb = null,
}) => {
  const user = await User.create({
    email,
    passwordHash,
    role,
    isVerified: true,
    authProvider,
    providerSubject,
    doctorApprovalStatus,
  });

  await PatientProfile.upsert({
    userId: user.id,
    firstName,
    lastName,
    email,
    licenseNb: isDoctorRole(role) ? licenseNb : null,
  });

  return user;
};

const ensureProviderConfig = (provider) => {
  const providerEnv = provider === 'google'
    ? ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']
    : ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY', 'APPLE_REDIRECT_URI'];

  const missing = providerEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required social auth configuration: ${missing.join(', ')}`);
  }
};

const exchangeGoogleCode = async (code) => {
  ensureProviderConfig('google');

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange Google authorization code.');
  }

  const tokenData = await response.json();
  const userResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to fetch Google profile.');
  }

  const profile = await userResponse.json();
  if (!profile.email || !profile.sub || profile.email_verified === false) {
    throw new Error('Google account did not provide a verified email.');
  }

  return {
    email: String(profile.email).toLowerCase().trim(),
    providerSubject: String(profile.sub),
    firstName: profile.given_name || '',
    lastName: profile.family_name || '',
    fallbackName: profile.name || '',
  };
};

const buildAppleClientSecret = () => {
  ensureProviderConfig('apple');

  const privateKey = String(process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return jwt.sign(
    {
      iss: process.env.APPLE_TEAM_ID,
      aud: 'https://appleid.apple.com',
      sub: process.env.APPLE_CLIENT_ID,
    },
    privateKey,
    {
      algorithm: 'ES256',
      expiresIn: '5m',
      keyid: process.env.APPLE_KEY_ID,
    }
  );
};

const verifyAppleIdToken = async (idToken) => {
  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded?.header?.kid;

  if (!kid) {
    throw new Error('Invalid Apple identity token.');
  }

  const jwksResponse = await fetch(APPLE_JWKS_URL);
  if (!jwksResponse.ok) {
    throw new Error('Failed to fetch Apple signing keys.');
  }

  const jwks = await jwksResponse.json();
  const jwk = Array.isArray(jwks.keys) ? jwks.keys.find((item) => item.kid === kid) : null;
  if (!jwk) {
    throw new Error('Apple signing key not found.');
  }

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  return jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    audience: process.env.APPLE_CLIENT_ID,
  });
};

const exchangeAppleCode = async ({ code, userPayload }) => {
  ensureProviderConfig('apple');

  const response = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.APPLE_CLIENT_ID,
      client_secret: buildAppleClientSecret(),
      grant_type: 'authorization_code',
      redirect_uri: process.env.APPLE_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange Apple authorization code.');
  }

  const tokenData = await response.json();
  const claims = await verifyAppleIdToken(tokenData.id_token);
  const parsedUser = typeof userPayload === 'string' && userPayload ? JSON.parse(userPayload) : null;
  const firstName = parsedUser?.name?.firstName || '';
  const lastName = parsedUser?.name?.lastName || '';
  const fallbackName = [firstName, lastName].filter(Boolean).join(' ');

  if (!claims.sub) {
    throw new Error('Apple account did not provide an account identifier.');
  }

  return {
    email: claims.email ? String(claims.email).toLowerCase().trim() : '',
    providerSubject: String(claims.sub),
    firstName,
    lastName,
    fallbackName,
  };
};

const findUserForSocialIdentity = async ({ provider, providerSubject, email }) => {
  const providerUser = await User.findOne({
    where: {
      authProvider: provider,
      providerSubject,
    },
  });

  if (providerUser) return providerUser;

  if (!email) return null;

  return User.findOne({
    where: {
      email,
    },
  });
};

const completeSocialLogin = async ({ provider, providerSubject, email, firstName, lastName, fallbackName, role }) => {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  let user = await findUserForSocialIdentity({ provider, providerSubject, email: normalizedEmail });

  if (!user) {
    if (!normalizedEmail) {
      const err = new Error('This provider did not return an email for account creation. Try signing in again or use another method.');
      err.code = 'SOCIAL_EMAIL_REQUIRED';
      throw err;
    }

    if (!VALID_ROLES.has(role)) {
      const err = new Error('Select your role before continuing with social sign-in.');
      err.code = 'SOCIAL_ROLE_REQUIRED';
      throw err;
    }

    const names = normalizeNameParts({ firstName, lastName, email: normalizedEmail, fallbackName });
    user = await createVerifiedUserWithProfile({
      firstName: names.firstName,
      lastName: names.lastName,
      email: normalizedEmail,
      role,
      authProvider: provider,
      providerSubject,
      doctorApprovalStatus: getDoctorApprovalStatusForNewUser({ role, isVerified: true }),
    });
  } else {
    const updates = {};

    if (user.authProvider === 'local') {
      updates.authProvider = provider;
      updates.providerSubject = providerSubject;
    } else if (!user.providerSubject) {
      updates.providerSubject = providerSubject;
    }

    if (!user.isVerified) {
      updates.isVerified = true;
    }

    if (isDoctorRole(user.role) && user.doctorApprovalStatus === DOCTOR_APPROVAL_STATUS.UNVERIFIED) {
      updates.doctorApprovalStatus = DOCTOR_APPROVAL_STATUS.PENDING;
    }

    if (Object.keys(updates).length > 0) {
      await user.update(updates);
    }

    const existingProfile = await PatientProfile.findOne({ where: { userId: user.id } });
    if (!existingProfile) {
      const names = normalizeNameParts({ firstName, lastName, email: user.email, fallbackName });
      await PatientProfile.create({
        userId: user.id,
        firstName: names.firstName,
        lastName: names.lastName,
        email: user.email,
      });
    }
  }

  if (user.email) {
    await PendingRegistration.destroy({
      where: {
        email: user.email,
      },
    });
  }

  if (user.mfaEnabled) {
    return buildMfaChallengeResponse(user, provider);
  }

  const token = issueAccessToken(user);
  const authUser = await buildAuthUser(user);
  return { token, user: authUser };
};

const handleSocialAuthError = (res, error) => {
  console.error(error);

  const code = error.code || 'SOCIAL_AUTH_FAILED';
  const message =
    code === 'SOCIAL_ROLE_REQUIRED'
      ? error.message
      : error.message || 'Social sign-in failed. Please try again.';

  return redirectToFrontend(res, {
    error: code,
    message,
  });
};

const getResetTokenRecord = async (rawToken) => {
  const token = String(rawToken || '').trim();
  if (!token) {
    return {
      error: {
        status: 400,
        code: 'RESET_TOKEN_MISSING',
        message: 'Reset token is required.',
      },
    };
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = await PasswordResetToken.findOne({ where: { tokenHash } });

  if (!record) {
    return {
      error: {
        status: 400,
        code: 'RESET_TOKEN_INVALID',
        message: 'This reset link is invalid or has already been used.',
      },
    };
  }

  if (new Date(record.expiresAt) < new Date()) {
    await PasswordResetToken.destroy({ where: { id: record.id } });
    return {
      error: {
        status: 400,
        code: 'RESET_TOKEN_EXPIRED',
        message: 'This reset link has expired. Request a new password reset email.',
      },
    };
  }

  return { record };
};

export const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, licenseNb } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: 'First name, last name, email, and password are required.',
      });
    }

    if (!isValidName(firstName)) {
      return res.status(400).json({
        message: 'First name must be at least 2 letters and may include spaces.',
      });
    }

    if (!isValidName(lastName)) {
      return res.status(400).json({
        message: 'Last name must be at least 2 letters and may include spaces.',
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

    if (!role || !VALID_ROLES.has(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const userRole = role;
    const licenseResult = isDoctorRole(userRole)
      ? normalizeDoctorLicense(licenseNb)
      : { ok: true, value: null };

    if (!licenseResult.ok) {
      return res.status(400).json({ message: licenseResult.message });
    }

    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();

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
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);

    if (EMAIL_VERIFICATION_DISABLED) {
      const user = await createVerifiedUserWithProfile({
        firstName: cleanFirstName,
        lastName: cleanLastName,
        email: cleanEmail,
        passwordHash,
        role: userRole,
        authProvider: 'local',
        doctorApprovalStatus: getDoctorApprovalStatusForNewUser({ role: userRole, isVerified: true }),
        licenseNb: licenseResult.value,
      });
      const token = issueAccessToken(user);
      const authUser = await buildAuthUser(user);

      return res.status(201).json({
        message: 'Registered successfully. Email verification is disabled for local testing.',
        token,
        user: authUser,
        verificationRequired: false,
      });
    }

    const rawToken = await createVerificationToken();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const pendingUser = buildPendingAuthUser({
      firstName: cleanFirstName,
      lastName: cleanLastName,
      email: cleanEmail,
      role: userRole,
      licenseNb: licenseResult.value,
    });

    try {
      const expiresAt = new Date(Date.now() + EMAIL_TOKEN_TTL_MS);

      if (existingPending) {
        existingPending.firstName = cleanFirstName;
        existingPending.lastName = cleanLastName;
        existingPending.email = cleanEmail;
        existingPending.passwordHash = passwordHash;
        existingPending.role = userRole;
        existingPending.licenseNb = licenseResult.value;
        existingPending.tokenHash = tokenHash;
        existingPending.expiresAt = expiresAt;
        await existingPending.save();
      } else {
        await PendingRegistration.create({
          firstName: cleanFirstName,
          lastName: cleanLastName,
          email: cleanEmail,
          passwordHash,
          role: userRole,
          licenseNb: licenseResult.value,
          tokenHash,
          expiresAt,
        });
      }

      await sendVerificationEmail({ to: cleanEmail, token: rawToken });

      return res.status(existingPending ? 200 : 201).json({
        message: existingPending
          ? 'Pending registration updated. Please verify your email using the newest link.'
          : 'Registered successfully. Please verify your email.',
        user: pendingUser,
        verificationRequired: true,
        ...(process.env.NODE_ENV === 'test' ? { verificationToken: rawToken } : {}),
      });
    } catch (mailErr) {
      if (!existingPending) {
        await PendingRegistration.destroy({ where: { email: cleanEmail } });
      }

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
      return res.status(400).json({
        code: 'VERIFICATION_TOKEN_MISSING',
        message: 'Verification token is required.',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const pendingRegistration = await PendingRegistration.findOne({ where: { tokenHash } });

    if (!pendingRegistration) {
      return res.status(400).json({
        code: 'VERIFICATION_TOKEN_INVALID',
        message: 'Invalid verification token.',
      });
    }

    if (new Date(pendingRegistration.expiresAt) < new Date()) {
      return res.status(400).json({
        code: 'VERIFICATION_TOKEN_EXPIRED',
        message: 'Verification link expired. Request a new email and try again.',
        email: pendingRegistration.email,
      });
    }

    const existingUser = await User.findOne({ where: { email: pendingRegistration.email } });
    if (existingUser) {
      await PendingRegistration.destroy({ where: { id: pendingRegistration.id } });
      return res.status(409).json({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Email already registered.',
      });
    }

    let user;
    try {
      user = await User.create({
        email: pendingRegistration.email,
        passwordHash: pendingRegistration.passwordHash,
        role: pendingRegistration.role,
        isVerified: true,
        doctorApprovalStatus: getDoctorApprovalStatusForNewUser({ role: pendingRegistration.role, isVerified: true }),
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
      licenseNb: isDoctorRole(pendingRegistration.role) ? pendingRegistration.licenseNb || null : null,
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

    try {
      await sendVerificationEmail({ to: pendingRegistration.email, token: rawToken });
    } catch (mailErr) {
      if (mailErr.message === 'SMTP_NOT_CONFIGURED') {
        return res.status(503).json({
          message: 'Email verification is not configured on the server. Add SMTP settings before resending.',
        });
      }
      throw mailErr;
    }

    return res.status(200).json({
      message: 'Verification email sent.',
      ...(process.env.NODE_ENV === 'test' ? { verificationToken: rawToken } : {}),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while resending verification email.' });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const cleanEmail = String(req.body?.email || '').toLowerCase().trim();
    if (!validator.isEmail(cleanEmail)) {
      return res.status(400).json({ message: 'Valid email is required.' });
    }

    const user = await User.findOne({ where: { email: cleanEmail } });

    if (!user) {
      return res.status(404).json({
        code: 'EMAIL_NOT_FOUND',
        message: 'Email does not exist.',
      });
    }

    if (user.authProvider !== 'local') {
      return res.status(400).json({
        code: 'PASSWORD_RESET_UNAVAILABLE',
        message: `This account uses ${user.authProvider === 'google' ? 'Google' : 'social'} sign-in and does not support password reset.`,
      });
    }

    const rawToken = await createPasswordResetToken();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await PasswordResetToken.destroy({
      where: {
        userId: user.id,
      },
    });

    await PasswordResetToken.create({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });

    try {
      await sendPasswordResetEmail({ to: cleanEmail, token: rawToken });
    } catch (mailErr) {
      await PasswordResetToken.destroy({
        where: {
          userId: user.id,
        },
      });

      if (mailErr.message === 'SMTP_NOT_CONFIGURED') {
        return res.status(503).json({
          message: 'Password reset email is not configured on the server. Add SMTP settings before using this feature.',
        });
      }

      throw mailErr;
    }

    return res.status(200).json({
      message: 'A password reset link has been sent.',
      ...(process.env.NODE_ENV === 'test' ? { resetToken: rawToken } : {}),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while requesting password reset.' });
  }
};

export const validatePasswordResetToken = async (req, res) => {
  try {
    const { record, error } = await getResetTokenRecord(req.query?.token || req.body?.token);
    if (error) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
      });
    }

    return res.status(200).json({
      message: 'Reset token is valid.',
      expiresAt: record.expiresAt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while validating reset token.' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { password } = req.body || {};

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: 'Password must be 10+ chars and include uppercase, lowercase, and a number.',
      });
    }

    const { record, error } = await getResetTokenRecord(req.body?.token || req.query?.token);
    if (error) {
      return res.status(error.status).json({
        code: error.code,
        message: error.message,
      });
    }

    const user = await User.findByPk(record.userId);
    if (!user) {
      await PasswordResetToken.destroy({ where: { id: record.id } });
      return res.status(404).json({
        code: 'RESET_USER_NOT_FOUND',
        message: 'User not found for this reset link.',
      });
    }

    if (user.authProvider !== 'local') {
      await PasswordResetToken.destroy({ where: { id: record.id } });
      return res.status(400).json({
        code: 'PASSWORD_RESET_UNAVAILABLE',
        message: 'This account uses social sign-in and does not support password reset.',
      });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    await user.save();

    await PasswordResetToken.destroy({
      where: {
        [Op.or]: [
          { id: record.id },
          { userId: user.id },
        ],
      },
    });

    return res.status(200).json({
      message: 'Password reset successfully. You can now sign in with your new password.',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while resetting password.' });
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

    const user = await User.scope('withSensitiveAuth').findOne({ where: { email: cleanEmail } });

    if (!user) {
      const pendingRegistration = await PendingRegistration.findOne({ where: { email: cleanEmail } });
      if (!pendingRegistration) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      const okPending = await bcrypt.compare(password, pendingRegistration.passwordHash);
      if (!okPending) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in.',
        email: cleanEmail,
      });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        code: 'PASSWORD_LOGIN_UNAVAILABLE',
        message: `This account uses ${user.authProvider === 'apple' ? 'Apple' : 'Google'} sign-in. Continue with that provider instead.`,
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!EMAIL_VERIFICATION_DISABLED && !user.isVerified) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in.',
        email: cleanEmail,
      });
    }

    if (user.mfaEnabled) {
      return res.json(await buildMfaChallengeResponse(user, 'local'));
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
      attributes: [
        'id',
        'email',
        'role',
        'isVerified',
        'doctorApprovalStatus',
        'doctorApprovalNotes',
        'doctorApprovalRequestedInfoAt',
        'createdAt',
        'authProvider',
        'mfaEnabled',
      ],
    });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const authUser = await buildAuthUser(user);
    return res.json({ user: { ...authUser, createdAt: user.createdAt } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

export const verifyTwoFactor = async (req, res) => {
  try {
    const { challengeToken, code } = req.body || {};
    if (!challengeToken || !code) {
      return res.status(400).json({ message: 'challengeToken and code are required.' });
    }

    const payload = verifyMfaChallengeToken(challengeToken);
    const user = await User.scope('withSensitiveAuth').findByPk(payload.sub);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (!user.mfaEnabled) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled for this account.' });
    }

    const result = await verifyMfaCodeForUser(user, code);
    if (!result.ok) {
      return res.status(401).json({ message: 'Invalid authentication code.' });
    }

    const token = issueAccessToken(user);
    const authUser = await buildAuthUser(user);
    return res.json({
      token,
      user: authUser,
      usedBackupCode: result.consumedBackupCode,
      message: 'Two-factor verification successful.',
    });
  } catch (err) {
    return res.status(401).json({ message: err.message || 'Invalid or expired MFA challenge.' });
  }
};

export const getMfaStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'authProvider', 'mfaEnabled', 'mfaRecoveryCodeHashes'],
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json({
      enabled: Boolean(user.mfaEnabled),
      authProvider: user.authProvider,
      backupCodesRemaining: Array.isArray(user.mfaRecoveryCodeHashes) ? user.mfaRecoveryCodeHashes.length : 0,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to load MFA status.' });
  }
};

export const beginMfaSetup = async (req, res) => {
  try {
    const { password } = req.body || {};
    const user = await User.scope('withPassword').findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await assertLocalPasswordIfNeeded(user, password);

    const secret = generateTotpSecret();
    const encryptedSecret = encryptMfaSecret(secret);
    const setupToken = createMfaSetupToken({ userId: user.id, encryptedSecret });

    return res.json({
      setupToken,
      ...buildMfaSetupPayload({ email: user.email, secret }),
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Failed to start two-factor setup.' });
  }
};

export const enableMfa = async (req, res) => {
  try {
    const { setupToken, code } = req.body || {};
    if (!setupToken || !code) {
      return res.status(400).json({ message: 'setupToken and code are required.' });
    }

    const payload = verifyMfaSetupToken(setupToken);
    if (payload.sub !== req.user.id) {
      return res.status(403).json({ message: 'This setup token does not belong to the current user.' });
    }

    const secret = decryptMfaSecret(payload.encryptedSecret);
    if (!verifyTotpCode(secret, code)) {
      return res.status(401).json({ message: 'Invalid authentication code.' });
    }

    const { codes, hashes } = await generateBackupCodes();
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await user.update({
      mfaEnabled: true,
      mfaSecretEncrypted: payload.encryptedSecret,
      mfaRecoveryCodeHashes: hashes,
    });

    return res.json({
      message: 'Two-factor authentication enabled.',
      backupCodes: codes,
    });
  } catch (err) {
    return res.status(401).json({ message: err.message || 'Failed to enable two-factor authentication.' });
  }
};

export const disableMfa = async (req, res) => {
  try {
    const { password, code } = req.body || {};
    if (!code) {
      return res.status(400).json({ message: 'A current authenticator or backup code is required.' });
    }

    const user = await User.scope('withSensitiveAuth').findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (!user.mfaEnabled) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled.' });
    }

    await assertLocalPasswordIfNeeded(user, password);

    const result = await verifyMfaCodeForUser(user, code);
    if (!result.ok) {
      return res.status(401).json({ message: 'Invalid authentication code.' });
    }

    await user.update({
      mfaEnabled: false,
      mfaSecretEncrypted: null,
      mfaRecoveryCodeHashes: [],
    });

    return res.json({ message: 'Two-factor authentication disabled.' });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Failed to disable two-factor authentication.' });
  }
};

export const regenerateMfaRecoveryCodes = async (req, res) => {
  try {
    const { password, code } = req.body || {};
    if (!code) {
      return res.status(400).json({ message: 'A current authenticator or backup code is required.' });
    }

    const user = await User.scope('withSensitiveAuth').findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (!user.mfaEnabled) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled.' });
    }

    await assertLocalPasswordIfNeeded(user, password);

    const result = await verifyMfaCodeForUser(user, code);
    if (!result.ok) {
      return res.status(401).json({ message: 'Invalid authentication code.' });
    }

    const { codes, hashes } = await generateBackupCodes();
    await user.update({ mfaRecoveryCodeHashes: hashes });

    return res.json({
      message: 'Backup codes regenerated.',
      backupCodes: codes,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Failed to regenerate backup codes.' });
  }
};

export const startGoogleAuth = async (req, res) => {
  try {
    ensureProviderConfig('google');

    const state = createSocialState({
      provider: 'google',
      role: String(req.query.role || '').trim().toLowerCase(),
      intent: String(req.query.intent || 'login').trim().toLowerCase(),
    });

    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');

    return res.redirect(authUrl.toString());
  } catch (error) {
    return handleSocialAuthError(res, error);
  }
};

export const googleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      throw new Error('Google sign-in did not return the required information.');
    }

    const parsedState = verifySocialState(state, 'google');
    const identity = await exchangeGoogleCode(String(code));
    const session = await completeSocialLogin({
      provider: 'google',
      ...identity,
      role: parsedState.role,
    });

    return redirectToFrontend(res, {
      token: session.token,
      user: JSON.stringify(session.user),
      provider: 'google',
    });
  } catch (error) {
    return handleSocialAuthError(res, error);
  }
};

export const startAppleAuth = async (req, res) => {
  try {
    ensureProviderConfig('apple');

    const state = createSocialState({
      provider: 'apple',
      role: String(req.query.role || '').trim().toLowerCase(),
      intent: String(req.query.intent || 'login').trim().toLowerCase(),
    });

    const authUrl = new URL(APPLE_AUTH_URL);
    authUrl.searchParams.set('client_id', process.env.APPLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', process.env.APPLE_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('response_mode', 'form_post');
    authUrl.searchParams.set('scope', 'name email');
    authUrl.searchParams.set('state', state);

    return res.redirect(authUrl.toString());
  } catch (error) {
    return handleSocialAuthError(res, error);
  }
};

export const appleCallback = async (req, res) => {
  try {
    const code = String(req.body?.code || req.query?.code || '').trim();
    const state = String(req.body?.state || req.query?.state || '').trim();
    const userPayload = req.body?.user || req.query?.user || '';

    if (!code || !state) {
      throw new Error('Apple sign-in did not return the required information.');
    }

    const parsedState = verifySocialState(state, 'apple');
    const identity = await exchangeAppleCode({ code, userPayload });
    const session = await completeSocialLogin({
      provider: 'apple',
      ...identity,
      role: parsedState.role,
    });

    return redirectToFrontend(res, {
      token: session.token,
      user: JSON.stringify(session.user),
      provider: 'apple',
    });
  } catch (error) {
    return handleSocialAuthError(res, error);
  }
};
