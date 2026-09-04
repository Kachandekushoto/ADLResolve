const pool = require('../config/db');

async function listCategories(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, slug, description FROM categories ORDER BY sort_order ASC'
    );
    res.json({ categories: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCategories };
