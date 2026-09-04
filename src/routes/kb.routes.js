const router = require('express').Router();
const kb = require('../controllers/kbController');

router.get('/', kb.searchArticles);
router.get('/:slug', kb.getArticle);

module.exports = router;
