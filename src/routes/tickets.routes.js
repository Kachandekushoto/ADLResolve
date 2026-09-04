const router = require('express').Router();
const tickets = require('../controllers/ticketController');
const { requireAuth, requireUser, requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(requireAuth);

// Customers create tickets; admins/agents view and manage all of them.
router.post('/', requireUser, upload.single('screenshot'), tickets.createTicket);
router.get('/', tickets.listTickets);                 // scoped by role inside the controller
router.get('/:id', tickets.getTicket);
router.patch('/:id/status', requireAdmin, tickets.updateStatus);
router.post('/:id/messages', upload.single('screenshot'), tickets.addMessage);

module.exports = router;
