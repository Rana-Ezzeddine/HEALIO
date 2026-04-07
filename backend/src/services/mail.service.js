import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let transporter = null;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localLogoPath = path.resolve(__dirname, '../../../frontend/public/logo.png');
const verificationLogoCid = 'healio-logo';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getVerificationLogoMarkup() {
  if (process.env.EMAIL_LOGO_URL) {
    const safeLogoUrl = escapeHtml(process.env.EMAIL_LOGO_URL);
    return `
      <img
        src="${safeLogoUrl}"
        alt="HEALIO"
        width="132"
        style="display:block;width:132px;max-width:100%;height:auto;margin:0 auto 8px;"
      />
    `;
  }

  if (fs.existsSync(localLogoPath)) {
    return `
      <img
        src="cid:${verificationLogoCid}"
        alt="HEALIO"
        width="156"
        style="display:block;width:156px;max-width:100%;height:auto;margin:0 auto 8px;"
      />
    `;
  }

  return `
      <div
        style="width:68px;height:68px;margin:0 auto 8px;border-radius:20px;background:#ffffff;color:#0f172a;font-size:26px;font-weight:800;line-height:68px;text-align:center;box-shadow:0 12px 26px rgba(15,23,42,0.16);"
      >
        H
      </div>
  `;
}

function buildVerificationEmail({ verifyUrl }) {
  const safeUrl = escapeHtml(verifyUrl);
  const supportEmail = escapeHtml(process.env.SUPPORT_EMAIL || 'support@healio.local');
  const expiryHours = Math.max(
    1,
    Math.round(Number(process.env.EMAIL_VERIFICATION_TTL_MS || 86400000) / 3600000)
  );
  const logoMarkup = getVerificationLogoMarkup();

  return {
    subject: 'Welcome to HEALIO. Verify your account',
    text: [
      'Welcome to HEALIO.',
      '',
      'Thanks for creating your account. Please verify your email to activate your profile and continue to your dashboard.',
      '',
      `Verify your account: ${verifyUrl}`,
      '',
      `For your security, this link expires in about ${expiryHours} hours.`,
      `Need help? Contact ${supportEmail}.`,
      'If you did not create a HEALIO account, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="margin:0;padding:40px 16px;background:radial-gradient(circle at top,#e0f2fe 0%,#f8fafc 46%,#eef2ff 100%);font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe7f3;border-radius:28px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.1);">
          <div style="padding:44px 40px 28px;background:linear-gradient(145deg,#0f172a 0%,#1d4ed8 55%,#0ea5e9 100%);color:#ffffff;text-align:center;">
            ${logoMarkup}
            <div style="display:inline-block;padding:8px 14px;border:1px solid rgba(255,255,255,0.28);border-radius:999px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;background:rgba(255,255,255,0.08);">
              Welcome to HEALIO
            </div>
            <h1 style="margin:14px 0 12px;font-size:34px;line-height:1.15;font-weight:800;">
              Verify your email and step into your care dashboard
            </h1>
            <p style="margin:0 auto;max-width:520px;font-size:16px;line-height:1.75;color:rgba(255,255,255,0.9);">
              Thanks for joining HEALIO. We designed your account to help you manage care, records, appointments, and communication in one secure place.
            </p>
          </div>

          <div style="padding:40px 40px 18px;">
            <div style="padding:22px 22px 18px;border-radius:20px;background:linear-gradient(180deg,#f8fbff 0%,#f8fafc 100%);border:1px solid #dbeafe;">
              <p style="margin:0 0 14px;font-size:16px;line-height:1.75;color:#334155;">
                Before you begin, please confirm that this email address belongs to you. Once verified, HEALIO will activate your account and take you straight into the experience.
              </p>
              <p style="margin:0;font-size:15px;line-height:1.75;color:#475569;">
                This verification link expires in about <strong>${expiryHours} hours</strong> for your security.
              </p>
            </div>

            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:30px auto 28px;">
              <tr>
                <td align="center" bgcolor="#2563eb" style="border-radius:16px;background:#2563eb;">
                  <a
                    href="${safeUrl}"
                    style="display:inline-block;padding:16px 32px;border-radius:16px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:0.01em;border:1px solid #2563eb;"
                  >
                    Verify My Email
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#64748b;text-align:center;">
              Fast, secure, and designed to keep your health journey organized.
            </p>

            <div style="padding:18px 20px;border-radius:16px;background:#f8fbff;border:1px solid #dbeafe;">
              <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#334155;font-weight:700;">
                Button not working?
              </p>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#475569;">
                Copy and paste this link into your browser:
              </p>
              <p style="margin:0;word-break:break-all;font-size:14px;line-height:1.7;">
                <a href="${safeUrl}" style="color:#2563eb;text-decoration:underline;">${safeUrl}</a>
              </p>
            </div>

            <div style="margin-top:28px;padding-top:24px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#64748b;">
                If you need help accessing your account, contact us at <a href="mailto:${supportEmail}" style="color:#2563eb;text-decoration:none;">${supportEmail}</a>.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.7;color:#64748b;">
                If you did not create a HEALIO account, you can safely ignore this email.
              </p>
            </div>
          </div>
        </div>
      </div>
    `,
  };
}

function buildPasswordResetEmail({ resetUrl }) {
  const safeUrl = escapeHtml(resetUrl);
  const supportEmail = escapeHtml(process.env.SUPPORT_EMAIL || 'support@healio.local');
  const expiryMinutes = Math.max(
    1,
    Math.round(Number(process.env.PASSWORD_RESET_TTL_MS || 3600000) / 60000)
  );
  const logoMarkup = getVerificationLogoMarkup();

  return {
    subject: 'Reset your HEALIO password',
    text: [
      'HEALIO password reset',
      '',
      'We received a request to reset your password.',
      '',
      `Reset your password: ${resetUrl}`,
      '',
      `For your security, this link expires in about ${expiryMinutes} minutes.`,
      `Need help? Contact ${supportEmail}.`,
      'If you did not request a password reset, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="margin:0;padding:40px 16px;background:radial-gradient(circle at top,#e0f2fe 0%,#f8fafc 46%,#eef2ff 100%);font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe7f3;border-radius:28px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.1);">
          <div style="padding:44px 40px 28px;background:linear-gradient(145deg,#0f172a 0%,#1d4ed8 55%,#0ea5e9 100%);color:#ffffff;text-align:center;">
            ${logoMarkup}
            <div style="display:inline-block;padding:8px 14px;border:1px solid rgba(255,255,255,0.28);border-radius:999px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;background:rgba(255,255,255,0.08);">
              Password Reset
            </div>
            <h1 style="margin:14px 0 12px;font-size:34px;line-height:1.15;font-weight:800;">
              Set a new password for your HEALIO account
            </h1>
            <p style="margin:0 auto;max-width:520px;font-size:16px;line-height:1.75;color:rgba(255,255,255,0.9);">
              Use the secure link below to choose a new password and get back into your account.
            </p>
          </div>

          <div style="padding:40px 40px 18px;">
            <div style="padding:22px 22px 18px;border-radius:20px;background:linear-gradient(180deg,#f8fbff 0%,#f8fafc 100%);border:1px solid #dbeafe;">
              <p style="margin:0 0 14px;font-size:16px;line-height:1.75;color:#334155;">
                If you requested a password reset, confirm it here. If not, you can ignore this email and your current password will stay the same.
              </p>
              <p style="margin:0;font-size:15px;line-height:1.75;color:#475569;">
                This reset link expires in about <strong>${expiryMinutes} minutes</strong>.
              </p>
            </div>

            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:30px auto 28px;">
              <tr>
                <td align="center" bgcolor="#2563eb" style="border-radius:16px;background:#2563eb;">
                  <a
                    href="${safeUrl}"
                    style="display:inline-block;padding:16px 32px;border-radius:16px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:0.01em;border:1px solid #2563eb;"
                  >
                    Reset My Password
                  </a>
                </td>
              </tr>
            </table>

            <div style="padding:18px 20px;border-radius:16px;background:#f8fbff;border:1px solid #dbeafe;">
              <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#334155;font-weight:700;">
                Button not working?
              </p>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#475569;">
                Copy and paste this link into your browser:
              </p>
              <p style="margin:0;word-break:break-all;font-size:14px;line-height:1.7;">
                <a href="${safeUrl}" style="color:#2563eb;text-decoration:underline;">${safeUrl}</a>
              </p>
            </div>

            <div style="margin-top:28px;padding-top:24px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#64748b;">
                If you need help accessing your account, contact us at <a href="mailto:${supportEmail}" style="color:#2563eb;text-decoration:none;">${supportEmail}</a>.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.7;color:#64748b;">
                If you did not request this password reset, you can safely ignore this email.
              </p>
            </div>
          </div>
        </div>
      </div>
    `,
  };
}

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  const port = Number(process.env.SMTP_PORT || 587);

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // secure: port === 465,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });

//   transporter = nodemailer.createTransport({
//     host: 'smtp.ethereal.email',
//     port: 587,
//     auth: {
//         user: 'otilia.terry@ethereal.email',
//         pass: 'wtxUcffNdTwctyykdj'
//     }
// });

  return transporter;
}

export async function sendVerificationEmail({ to, token }) {
  if (process.env.NODE_ENV === 'test') return { skipped: true };

  const baseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const email = buildVerificationEmail({ verifyUrl });
  const tx = getTransporter();

  if (!tx) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }

  const attachments = fs.existsSync(localLogoPath)
    ? [
        {
          filename: 'healio-logo.png',
          path: localLogoPath,
          cid: verificationLogoCid,
        },
      ]
    : [];

  await tx.sendMail({
    from: process.env.SMTP_FROM || 'HEALIO <no-reply@healio.local>',
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    attachments,
  });

  return { skipped: false, verifyUrl };
}

export async function sendPasswordResetEmail({ to, token }) {
  if (process.env.NODE_ENV === 'test') return { skipped: true };

  const baseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const email = buildPasswordResetEmail({ resetUrl });
  const tx = getTransporter();

  if (!tx) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }

  const attachments = fs.existsSync(localLogoPath)
    ? [
        {
          filename: 'healio-logo.png',
          path: localLogoPath,
          cid: verificationLogoCid,
        },
      ]
    : [];

  await tx.sendMail({
    from: process.env.SMTP_FROM || 'HEALIO <no-reply@healio.local>',
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    attachments,
  });

  return { skipped: false, resetUrl };
}

export async function sendDoctorEmergencyAlert({ to, patientEmail, reason }) {
  if (process.env.NODE_ENV === 'test') return { skipped: true };

  const tx = getTransporter();
  if (!tx) return { skipped: true };

  await tx.sendMail({
    from: process.env.SMTP_FROM || 'HEALIO <no-reply@healio.local>',
    to,
    subject: 'HEALIO Emergency Alert',
    text: `Emergency alert from patient ${patientEmail}. Reason: ${reason || 'N/A'}`,
    html: `<p><strong>Emergency alert</strong></p><p>Patient: ${patientEmail}</p><p>Reason: ${reason || 'N/A'}</p>`,
  });

  return { skipped: false };
}
