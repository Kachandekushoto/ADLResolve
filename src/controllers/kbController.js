const pool = require('../config/db');

async function searchArticles(req, res, next) {
  try {
    const { q, categoryId } = req.query;
    const where = ['is_published = 1'];
    const params = [];

    if (q) {
      where.push('(title LIKE ? OR summary LIKE ? OR content LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (categoryId) {
      where.push('category_id = ?');
      params.push(categoryId);
    }

    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.slug, a.summary, c.name AS category_name
       FROM knowledge_base_articles a
       JOIN categories c ON c.id = a.category_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.updated_at DESC
       LIMIT 50`,
      params
    );
    res.json({ articles: rows });
  } catch (err) {
    next(err);
  }
}

async function getArticle(req, res, next) {
  try {
    const { slug } = req.params;
    const [rows] = await pool.query(
      `SELECT a.*, c.name AS category_name
       FROM knowledge_base_articles a
       JOIN categories c ON c.id = a.category_id
       WHERE a.slug = ? AND a.is_published = 1`,
      [slug]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Article not found.' });
    res.json({ article: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { searchArticles, getArticle };
