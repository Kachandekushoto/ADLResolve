const pool = require('../config/db');

async function getProfile(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, created_at FROM users WHERE id = ?',
      [req.auth.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Profile not found.' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { name, phone } = req.body;
    await pool.query('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?', [
      name || null, phone || null, req.auth.id
    ]);
    res.json({ message: 'Profile updated.' });
  } catch (err) {
    next(err);
  }
}

async function getAdminProfile(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, is_active, created_at FROM admin_users WHERE id = ?',
      [req.auth.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Admin profile not found.' });
    res.json({ admin: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateAdminProfile(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
    await pool.query('UPDATE admin_users SET name = ? WHERE id = ?', [name.trim(), req.auth.id]);
    res.json({ message: 'Admin profile updated.' });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------ admin-only
async function listUsers(req, res, next) {
  try {
    const { search } = req.query;
    const where = [];
    const params = [];
    if (search) {
      where.push('(name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.created_at,
              (SELECT COUNT(*) FROM support_tickets t WHERE t.user_id = u.id) AS ticket_count
       FROM users u ${whereSql}
       ORDER BY u.created_at DESC LIMIT 200`,
      params
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile, getAdminProfile, updateAdminProfile, listUsers };
