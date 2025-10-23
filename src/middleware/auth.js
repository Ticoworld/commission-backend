const jwt = require('jsonwebtoken');
const env = require('../config/env');

function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { id: payload.id, role: payload.role, lgaId: payload.lgaId || null, name: payload.name };
    return next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

function scopeToLGA(query, req) {
  if (req.user && req.user.role === 'LGA') {
    return { ...query, where: { ...(query.where || {}), lgaId: req.user.lgaId || undefined } };
  }
  return query;
}

module.exports = { authenticate, requireRole, scopeToLGA };