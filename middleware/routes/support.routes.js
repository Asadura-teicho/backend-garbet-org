const express = require('express');
const router = express.Router();
const {
  createTicket,
  getMyTickets,
  getTicketById,
  respondToTicket,
  updateTicketStatus,
  getAllTickets,
  closeTicket,
  getTicketStatistics,
} = require('../controllers/support.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// All routes require authentication
router.use(authMiddleware);

// User routes
router.post('/ticket', createTicket);
router.get('/my-tickets', getMyTickets);
router.get('/tickets/:id', getTicketById);
router.post('/tickets/:id/respond', respondToTicket);

// Admin routes
router.get('/tickets', adminMiddleware, getAllTickets);
router.put('/tickets/:id/status', adminMiddleware, updateTicketStatus);
router.post('/tickets/:id/close', adminMiddleware, closeTicket);
router.get('/statistics', adminMiddleware, getTicketStatistics);

module.exports = router;

