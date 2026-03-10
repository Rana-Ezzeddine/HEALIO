import ActivityLog from '../models/ActivityLog.js';

export default function activityLogger() {
  return (req, res, next) => {
    const startTime = Date.now();
    let action = null;
    let metadata = null;

    req.setActivity = (customAction, customMetadata = null) => {
      action = customAction;
      metadata = customMetadata;
    };

    res.on('finish', async () => {
      if (req.path === '/health') return;

      try {
        await ActivityLog.create({
          userId: req.user?.id || null,
          action: action || `${req.method} ${req.path}`,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          ip: req.ip,
          userAgent: req.headers['user-agent'] || null,
          metadata: {
            durationMs: Date.now() - startTime,
            ...(metadata || {}),
          },
        });
      } catch (err) {
        console.error('Failed to write activity log:', err.message);
      }
    });

    next();
  };
}
