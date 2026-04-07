function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function requireReviewer(req, res, next) {
  if (req.user?.role === 'reviewer' || req.user?.role === 'admin') {
    req.reviewer = {
      type: 'role',
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
    };
    return next();
  }

  const configuredApiKey = String(process.env.DOCTOR_REVIEWER_API_KEY || '').trim();
  const providedApiKey = String(req.headers['x-reviewer-api-key'] || '').trim();

  if (configuredApiKey && providedApiKey && providedApiKey === configuredApiKey) {
    req.reviewer = { type: 'api_key' };
    return next();
  }

  const allowedEmails = parseCsv(process.env.DOCTOR_REVIEWER_EMAILS).map((email) => email.toLowerCase());
  const allowedIds = parseCsv(process.env.DOCTOR_REVIEWER_IDS);
  const requesterEmail = String(req.user?.email || '').toLowerCase();

  if (
    (requesterEmail && allowedEmails.includes(requesterEmail)) ||
    (req.user?.id && allowedIds.includes(req.user.id))
  ) {
    req.reviewer = {
      type: 'allowlist',
      userId: req.user.id,
      email: req.user.email,
    };
    return next();
  }

  return res.status(403).json({
    code: 'REVIEWER_ACCESS_REQUIRED',
    message: 'Reviewer access is required for this action.',
  });
}
