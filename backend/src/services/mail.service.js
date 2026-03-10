import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  const port = Number(process.env.SMTP_PORT || 587);

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });

  return transporter;
}

export async function sendVerificationEmail({ to, token }) {
  if (process.env.NODE_ENV === 'test') return { skipped: true };

  const tx = getTransporter();

  // In local env, allow flow without SMTP configured.
  if (!tx) return { skipped: true };

  const baseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

  await tx.sendMail({
    from: process.env.SMTP_FROM || 'HEALIO <no-reply@healio.local>',
    to,
    subject: 'Verify your HEALIO account',
    text: `Verify your account by opening this link: ${verifyUrl}`,
    html: `<p>Welcome to HEALIO.</p><p>Verify your account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });

  return { skipped: false };
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
