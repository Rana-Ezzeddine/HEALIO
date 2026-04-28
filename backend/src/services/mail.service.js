import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ================== PATH SETUP ==================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localLogoPath = path.resolve(__dirname, '../../../frontend/public/logo.png');
const verificationLogoCid = 'healio-logo';

// ================== HELPERS ==================
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ================== LOGO ==================
function getVerificationLogoMarkup() {
  if (process.env.EMAIL_LOGO_URL) {
    const safeLogoUrl = escapeHtml(process.env.EMAIL_LOGO_URL);
    return `
      <img src="${safeLogoUrl}" alt="HEALIO"
        width="132"
        style="display:block;margin:0 auto 8px;" />
    `;
  }

  if (fs.existsSync(localLogoPath)) {
    return `
      <img src="cid:${verificationLogoCid}" alt="HEALIO"
        width="156"
        style="display:block;margin:0 auto 8px;" />
    `;
  }

  return `
    <div style="width:68px;height:68px;margin:0 auto 8px;border-radius:20px;background:#fff;text-align:center;line-height:68px;font-weight:bold;">
      H
    </div>
  `;
}

// ================== EMAIL BUILDERS ==================
function buildVerificationEmail({ verifyUrl }) {
  const safeUrl = escapeHtml(verifyUrl);
  const logo = getVerificationLogoMarkup();

  return {
    subject: 'Welcome to HEALIO. Verify your account',
    text: `Verify your account: ${verifyUrl}`,
    html: `
      <div style="font-family:Arial;padding:20px;">
        ${logo}
        <h2>Verify your email</h2>
        <p>Please confirm your account:</p>
        <a href="${safeUrl}" style="color:#2563eb;">Verify Email</a>
      </div>
    `,
  };
}

function buildPasswordResetEmail({ resetUrl }) {
  const safeUrl = escapeHtml(resetUrl);

  return {
    subject: 'Reset your HEALIO password',
    text: `Reset password: ${resetUrl}`,
    html: `
      <div style="font-family:Arial;padding:20px;">
        <h2>Password Reset</h2>
        <a href="${safeUrl}" style="color:#2563eb;">Reset Password</a>
      </div>
    `,
  };
}

// ================== TRANSPORT ==================
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('MAILTRAP_SMTP_NOT_CONFIGURED');
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,          // sandbox.smtp.mailtrap.io
    port: Number(process.env.SMTP_PORT || 2525),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

// ================== SEND FUNCTIONS ==================
export async function sendVerificationEmail({ to, token }) {
  console.log('[sendVerificationEmail] called with:', { to, token });

  if (process.env.NODE_ENV === 'test') {
    console.log('[sendVerificationEmail] Skipping email (test environment)');
    return { skipped: true };
  }

  try {
    const baseUrl =
      process.env.APP_BASE_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:5173';

    const normalizedBaseUrl = String(baseUrl).replace(/\/+$/, '');

    console.log('[sendVerificationEmail] baseUrl:', baseUrl);

    const verifyUrl = `${normalizedBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
    console.log('[sendVerificationEmail] verifyUrl:', verifyUrl);

    const email = buildVerificationEmail({ verifyUrl });
    console.log('[sendVerificationEmail] email content built:', {
      subject: email.subject,
    });

    const tx = getTransporter();
    console.log('[sendVerificationEmail] transporter initialized');

    const logoExists = fs.existsSync(localLogoPath);
    console.log('[sendVerificationEmail] logo exists:', logoExists);

    const attachments = logoExists
      ? [{
          filename: 'healio-logo.png',
          path: localLogoPath,
          cid: verificationLogoCid,
        }]
      : [];

    console.log('[sendVerificationEmail] attachments:', attachments.length);

    const info = await tx.sendMail({
      from: process.env.SMTP_FROM || 'HEALIO <no-reply@healio.local>',
      to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      attachments,
    });

    console.log('[sendVerificationEmail] email sent successfully:', info);

    return { skipped: false, verifyUrl };
  } catch (error) {
    console.error('[sendVerificationEmail] ERROR:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail({ to, token }) {
  if (process.env.NODE_ENV === 'test') return { skipped: true };

  const baseUrl =
    process.env.APP_BASE_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173';

  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const email = buildPasswordResetEmail({ resetUrl });
  const tx = getTransporter();

  await tx.sendMail({
    from: process.env.SMTP_FROM || 'HEALIO <no-reply@healio.local>',
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  return { skipped: false, resetUrl };
}

export async function sendDoctorEmergencyAlert({ to, patientEmail, reason }) {
  if (process.env.NODE_ENV === 'test') return { skipped: true };

  const tx = getTransporter();

  await tx.sendMail({
    from: process.env.SMTP_FROM || 'HEALIO <no-reply@healio.local>',
    to,
    subject: 'HEALIO Emergency Alert',
    text: `Emergency alert from ${patientEmail}. Reason: ${reason || 'N/A'}`,
    html: `<p><strong>Emergency alert</strong></p><p>${patientEmail}</p><p>${reason || 'N/A'}</p>`,
  });

  return { skipped: false };
}