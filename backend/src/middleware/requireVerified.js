import User from '../models/User.js';

export default async function requireVerified(req, res, next) {
  try {
    if (/^true$/i.test(process.env.DISABLE_EMAIL_VERIFICATION || '')) {
      req.user.isVerified = true;
      return next();
    }

    if (!req.user?.id) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'isVerified'],
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before accessing this resource.',
      });
    }

    req.user.isVerified = true;
    return next();
  } catch (err) {
    console.error('requireVerified error:', err);
    return res.status(500).json({ message: 'Failed to validate verification status.' });
  }
}
