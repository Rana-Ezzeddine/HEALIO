import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ================== PATH SETUP ==================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localLogoPath = path.resolve(__dirname, '../../../frontend/public/logo.png');

// ================== RESEND SETUP ==================
const resend = new Resend(process.env.RESEND_API_KEY);

// For demo while domain is not verified:
const EMAIL_FROM = process.env.EMAIL_FROM || 'HEALIO <onboarding@resend.dev>';

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

  return `
    <div style="width:68px;height:68px;margin:0 auto 8px;border-radius:20px;background:#e0f2f1;text-align:center;line-height:68px;font-weight:bold;color:#047857;">
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
        <p>Please confirm your HEALIO account by clicking the link below:</p>
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
        <p>Click below to reset your password:</p>
        <a href="${safeUrl}" style="color:#2563eb;">Reset Password</a>
      </div>
    `,
  };
}

// ================== SEND FUNCTIONS ==================
export async function sendVerificationEmail({ to, token }) {
  console.log('[sendVerificationEmail] called with:', { to, token });

  if (process.env.NODE_ENV === 'test') {
    console.log('[sendVerificationEmail] Skipping email (test environment)');
    return { skipped: true };
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY_NOT_CONFIGURED');
  }

  try {
    const baseUrl =
      process.env.APP_BASE_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:5173';

    const normalizedBaseUrl = String(baseUrl).replace(/\/+$/, '');
    const verifyUrl = `${normalizedBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;

    console.log('[sendVerificationEmail] verifyUrl:', verifyUrl);

    const email = buildVerificationEmail({ verifyUrl });

    const info = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: email.subject,
      text: email.text,
      html: email.html,
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

  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY_NOT_CONFIGURED');
  }

  const baseUrl =
    process.env.APP_BASE_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173';

  const normalizedBaseUrl = String(baseUrl).replace(/\/+$/, '');
  const resetUrl = `${normalizedBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const email = buildPasswordResetEmail({ resetUrl });

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  return { skipped: false, resetUrl };
}

export async function sendDoctorEmergencyAlert({ to, patientEmail, reason }) {
  if (process.env.NODE_ENV === 'test') return { skipped: true };

  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY_NOT_CONFIGURED');
  }

  await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: 'HEALIO Emergency Alert',
    text: `Emergency alert from ${patientEmail}. Reason: ${reason || 'N/A'}`,
    html: `
      <p><strong>Emergency alert</strong></p>
      <p>${escapeHtml(patientEmail)}</p>
      <p>${escapeHtml(reason || 'N/A')}</p>
    `,
  });

  return { skipped: false };
}