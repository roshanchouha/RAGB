const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderId: {
    type: String,
    required: true,
  },
  paymentId: {
    type: String,
    required: true,
  },
  amount: {
    type: Number, // Amount in INR rupees e.g. 2499
    required: true,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'pro',
  },
  status: {
    type: String,
    enum: ['completed', 'failed', 'refunded'],
    default: 'completed',
  },
  paymentMethod: {
    type: String,
    default: 'Razorpay',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

transactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
