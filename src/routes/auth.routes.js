const router = require('express').Router();
const auth = require('../controllers/authController');

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);
router.post('/admin/login', auth.adminLogin);
router.post('/admin/forgot-password', auth.adminForgotPassword);
router.post('/admin/reset-password', auth.adminResetPassword);

module.exports = router;
