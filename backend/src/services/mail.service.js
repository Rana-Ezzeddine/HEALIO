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

function buildEmailShell({ eyebrow = 'HEALIO', title, intro, actionLabel, actionUrl, note, footer }) {
  const safeEyebrow = escapeHtml(eyebrow);
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeActionUrl = escapeHtml(actionUrl);
  const safeNote = note ? escapeHtml(note) : '';
  const safeFooter = footer ? escapeHtml(footer) : '';

  return `
    <div style="margin:0;padding:32px 16px;background:linear-gradient(180deg,#f4fbff 0%,#eef6fb 100%);font-family:'Inter',Arial,sans-serif;color:#16324f;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe8f2;border-radius:24px;overflow:hidden;box-shadow:0 18px 44px rgba(22,50,79,0.10);">
        <div style="padding:36px 36px 20px;background:linear-gradient(135deg,#effaf8 0%,#f8fbff 100%);border-bottom:1px solid #e5eef5;">
          <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#dff5ee;color:#0f766e;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            ${safeEyebrow}
          </div>
          <h1 style="margin:18px 0 12px;font-size:31px;line-height:1.15;color:#10213a;font-weight:800;">
            ${safeTitle}
          </h1>
          <p style="margin:0;font-size:16px;line-height:1.7;color:#506684;">
            ${safeIntro}
          </p>
        </div>

        <div style="padding:32px 36px 18px;">
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${safeActionUrl}" style="display:inline-block;padding:15px 28px;border-radius:14px;background:linear-gradient(135deg,#27b8f2 0%,#726ef2 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 12px 26px rgba(64,119,242,0.28);">
              ${safeActionLabel}
            </a>
          </div>

          <div style="padding:18px 20px;border-radius:16px;background:#f7fbfe;border:1px solid #e2ecf5;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#314966;text-transform:uppercase;letter-spacing:0.06em;">
              Direct link
            </p>
            <p style="margin:0;word-break:break-word;">
              <a href="${safeActionUrl}" style="color:#2f72e5;text-decoration:none;font-size:14px;line-height:1.7;">
                ${safeActionUrl}
              </a>
            </p>
          </div>

          ${safeNote ? `
            <p style="margin:22px 0 0;font-size:14px;line-height:1.7;color:#61758f;">
              ${safeNote}
            </p>
          ` : ''}
        </div>

        <div style="padding:20px 36px 34px;">
          <div style="height:1px;background:#e5eef5;margin-bottom:18px;"></div>
          <p style="margin:0;font-size:13px;line-height:1.7;color:#7b8da6;">
            ${safeFooter || 'If you did not request this email, you can safely ignore it.'}
          </p>
        </div>
      </div>
    </div>
  `;
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
  return {
    subject: 'HEALIO: Verify your email address',
    text: [
      'Welcome to HEALIO.',
      '',
      'Please verify your email address by opening this link:',
      verifyUrl,
      '',
      'If you did not create this account, you can ignore this message.',
    ].join('\n'),
    html: buildEmailShell({
      title: 'Verify your email address',
      intro: 'Thanks for joining HEALIO. Confirm your email to activate your account and continue securely.',
      actionLabel: 'Verify email',
      actionUrl: verifyUrl,
      note: 'For security, this verification link should only be used by the person who created the account.',
      footer: 'If you did not create a HEALIO account, you can safely ignore this message and no changes will be made.',
    }),
  };
}

function buildPasswordResetEmail({ resetUrl }) {
  return {
    subject: 'HEALIO: Reset your password',
    text: [
      'A password reset was requested for your HEALIO account.',
      '',
      'Open this link to choose a new password:',
      resetUrl,
      '',
      'If you did not request this, you can ignore this message.',
    ].join('\n'),
    html: buildEmailShell({
      title: 'Reset your password',
      intro: 'We received a request to reset your HEALIO password. Use the button below to choose a new one.',
      actionLabel: 'Reset password',
      actionUrl: resetUrl,
      note: 'If you did not request a password reset, you can ignore this email. Your account will stay unchanged.',
      footer: 'For your security, this link should only be used by you and will expire automatically.',
    }),
  };
}

function getFrontendAppBaseUrl() {
  const baseUrl =
    process.env.FRONTEND_URL ||
    process.env.APP_BASE_URL ||
    'http://localhost:5173';

  return String(baseUrl).replace(/\/+$/, '');
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
  if (isGmailApiConfigured()) {
    const from = process.env.EMAIL_FROM || process.env.GOOGLE_SENDER_EMAIL;
    return sendViaGmailApi({ from, to, subject, text, html });
  }

  if (isBrevoApiConfigured()) {
    return sendViaBrevoApi({ to, subject, text, html });
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
    const normalizedBaseUrl = getFrontendAppBaseUrl();

    console.log('[sendVerificationEmail] baseUrl:', normalizedBaseUrl);

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

  const baseUrl = getFrontendAppBaseUrl();
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
