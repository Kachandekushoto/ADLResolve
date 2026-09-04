const router = require('express').Router();
const { listCategories } = require('../controllers/categoryController');

router.get('/', listCategories);

module.exports = router;
