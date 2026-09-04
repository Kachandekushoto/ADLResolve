const jwt = require('jsonwebtoken');

/**
 * Verifies the JWT on the Authorization header and attaches the decoded
 * payload to req.auth. Payload shape: { id, type: 'user' | 'admin', role? }
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/** Restricts a route to authenticated customers. */
function requireUser(req, res, next) {
  if (req.auth?.type !== 'user') {
    return res.status(403).json({ error: 'Customer account required.' });
  }
  next();
}

/** Restricts a route to authorized IT support staff. */
function requireAdmin(req, res, next) {
  if (req.auth?.type !== 'admin' || !['admin', 'it_staff'].includes(req.auth?.role)) {
    return res.status(403).json({ error: 'IT support staff account required.' });
  }
  next();
}

/** Restricts a route to admin_users with role = 'admin' (not plain agents). */
function requireAdminRole(req, res, next) {
  if (req.auth?.type !== 'admin' || req.auth?.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator privileges required.' });
  }
  next();
}

module.exports = { requireAuth, requireUser, requireAdmin, requireAdminRole };
