import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

  if (!isGmailApiConfigured() && fs.existsSync(localLogoPath)) {
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

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('MAIL_DELIVERY_NOT_CONFIGURED');
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,          // sandbox.smtp.mailtrap.io
    port: Number(process.env.SMTP_PORT || 2525),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || Number(process.env.SMTP_PORT || 2525) === 465,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 15000),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

function isGmailApiConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_MAIL_REFRESH_TOKEN &&
    process.env.GOOGLE_SENDER_EMAIL
  );
}

function isBrevoApiConfigured() {
  return Boolean(
    process.env.BREVO_API_KEY &&
    process.env.BREVO_SENDER_EMAIL
  );
}

async function getGoogleMailAccessToken() {
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_MAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GOOGLE_MAIL_TOKEN_FAILED: ${errorText || response.statusText}`);
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error('GOOGLE_MAIL_TOKEN_MISSING');
  }

  return payload.access_token;
}

function encodeSubject(subject) {
  if (/^[\x00-\x7F]*$/.test(subject)) {
    return subject;
  }

  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

function buildRawEmail({ from, to, subject, text, html }) {
  const boundary = `healio-${crypto.randomUUID?.() || Date.now()}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    text || '',
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html || '',
    '',
    `--${boundary}--`,
    '',
  ];

  return Buffer.from(lines.join('\r\n'), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sendViaGmailApi({ from, to, subject, text, html }) {
  const accessToken = await getGoogleMailAccessToken();
  const raw = buildRawEmail({ from, to, subject, text, html });

  const response = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GOOGLE_MAIL_SEND_FAILED: ${errorText || response.statusText}`);
  }

  return response.json();
}

async function sendViaBrevoApi({ to, subject, text, html }) {
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'HEALIO';

  const response = await fetch(BREVO_SEND_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BREVO_SEND_FAILED: ${errorText || response.statusText}`);
  }

  return response.json();
}

async function sendEmail({ to, subject, text, html, attachments = [] }) {
  if (isBrevoApiConfigured()) {
    return sendViaBrevoApi({ to, subject, text, html });
  }

  if (isGmailApiConfigured()) {
    const from = process.env.EMAIL_FROM || process.env.GOOGLE_SENDER_EMAIL;
    return sendViaGmailApi({ from, to, subject, text, html });
  }

  const tx = getTransporter();

  return tx.sendMail({
    from: process.env.SMTP_FROM || 'HEALIO <no-reply@healio.local>',
    to,
    subject,
    text,
    html,
    attachments,
  });
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

    const info = await sendEmail({
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
  await sendEmail({
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  return { skipped: false, resetUrl };
}

export async function sendDoctorEmergencyAlert({ to, patientEmail, reason }) {
  if (process.env.NODE_ENV === 'test') return { skipped: true };

  await sendEmail({
    to,
    subject: 'HEALIO Emergency Alert',
    text: `Emergency alert from ${patientEmail}. Reason: ${reason || 'N/A'}`,
    html: `<p><strong>Emergency alert</strong></p><p>${patientEmail}</p><p>${reason || 'N/A'}</p>`,
  });

  return { skipped: false };
}
