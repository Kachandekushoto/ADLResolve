const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { isMailConfigured, sendPasswordResetEmail } = require('../utils/mailer');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------- customer auth
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash]
    );

    const token = signToken({ id: result.insertId, type: 'user' });
    res.status(201).json({
      token,
      user: { id: result.insertId, name, email }
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?',
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken({ id: user.id, type: 'user' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const [rows] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [email]);

    // Always respond the same way, whether or not the email exists,
    // so the endpoint can't be used to enumerate registered accounts.
    if (rows.length) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.query(
        'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [hashResetToken(resetToken), expires, rows[0].id]
      );
      await sendPasswordResetEmail({ to: rows[0].email, name: rows[0].name, token: resetToken });
      return res.json({ message: 'If that email is registered, a reset link has been sent.', devResetToken: !isMailConfigured() && process.env.NODE_ENV !== 'production' ? resetToken : undefined });
    }

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'A valid token and an 8+ character password are required.' });
    }

    const [rows] = await pool.query(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [hashResetToken(token)]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'That reset link is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [passwordHash, rows[0].id]
    );
    res.json({ message: 'Password updated. You can now log in.' });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------- admin auth
async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query(
      "SELECT id, name, email, password_hash, role FROM admin_users WHERE email = ? AND is_active = 1 AND role IN ('admin', 'it_staff')",
      [email]
    );
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken({ id: admin.id, type: 'admin', role: admin.role });
    res.json({
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (err) {
    next(err);
  }
}

async function adminForgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const [rows] = await pool.query(
      "SELECT id, name, email FROM admin_users WHERE email = ? AND is_active = 1 AND role IN ('admin', 'it_staff')",
      [email]
    );

    // Always respond the same way, whether or not the email exists,
    // so the endpoint can't be used to enumerate registered accounts.
    if (rows.length) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.query(
        'UPDATE admin_users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [hashResetToken(resetToken), expires, rows[0].id]
      );
      await sendPasswordResetEmail({ to: rows[0].email, name: rows[0].name, token: resetToken, isAdmin: true });
      return res.json({ message: 'If that email is registered, a reset link has been sent.', devResetToken: !isMailConfigured() && process.env.NODE_ENV !== 'production' ? resetToken : undefined });
    }

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

async function adminResetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'A valid token and an 8+ character password are required.' });
    }

    const [rows] = await pool.query(
      "SELECT id FROM admin_users WHERE reset_token = ? AND reset_token_expires > NOW() AND is_active = 1 AND role IN ('admin', 'it_staff')",
      [hashResetToken(token)]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'That reset link is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      'UPDATE admin_users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [passwordHash, rows[0].id]
    );
    res.json({ message: 'Password updated. You can now log in.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, forgotPassword, resetPassword, adminLogin, adminForgotPassword, adminResetPassword };
