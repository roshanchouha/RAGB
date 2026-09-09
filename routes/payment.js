const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  createOrder,
  verifyPayment,
  getPaymentHistory,
  getPaymentKey,
} = require('../controllers/paymentController');

router.use(authMiddleware);

router.post('/create-order', createOrder);
router.post('/verify-payment', verifyPayment);
router.get('/history', getPaymentHistory);
router.get('/key', getPaymentKey);

module.exports = router;
