const router = require('express').Router();
const users = require('../controllers/userController');
const { requireAuth, requireUser, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);

router.get('/me', requireUser, users.getProfile);
router.patch('/me', requireUser, users.updateProfile);
router.get('/admin/me', requireAdmin, users.getAdminProfile);
router.patch('/admin/me', requireAdmin, users.updateAdminProfile);

// Admin dashboard: browse/search customer accounts
router.get('/', requireAdmin, users.listUsers);

module.exports = router;
