import { ApiKey, User } from '../models/index.js';

/**
 * Middleware to authenticate requests using an API key. 
 * Expected header: X-API-KEY
 */
export const apiKeyAuth = async (req, res, next) => {
  const apiKeyString = req.headers['x-api-key'];

  if (!apiKeyString) {
    return res.status(401).json({ error: 'API Key is required in X-API-KEY header.' });
  }

  try {
    const apiKey = await ApiKey.findOne({
      where: { key: apiKeyString, isActive: true },
      include: [{ model: User, as: 'owner' }]
    });

    if (!apiKey || !apiKey.owner) {
      return res.status(401).json({ error: 'Invalid or inactive API key.' });
    }

    // Attach owner (doctor/caregiver) to request
    req.user = {
      id: apiKey.owner.id,
      role: apiKey.owner.role,
      email: apiKey.owner.email,
      isApiKey: true,
      scopes: apiKey.scopes || []
    };

    // Update last used timestamp
    apiKey.lastUsedAt = new Date();
    await apiKey.save();

    next();
  } catch (error) {
    console.error('API Key Authentication Error:', error);
    return res.status(500).json({ error: 'Internal security error during API key authentication.' });
  }
};

/**
 * Helper middleware to check if the API key has the required scope.
 */
export const requireScope = (requiredScope) => {
  return (req, res, next) => {
    if (!req.user.isApiKey) return next(); // Skip if not an API key (e.g., regular session auth)
    
    if (req.user.scopes.includes(requiredScope) || req.user.scopes.includes('*')) {
      return next();
    }
    
    return res.status(403).json({ 
      error: `Forbidden: API Key lacks required scope: ${requiredScope}` 
    });
  };
};
