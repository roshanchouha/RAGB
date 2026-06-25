const mongoose = require('mongoose');

const usageTrackingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  date: {
    type: String,
    required: [true, 'Date is required'], // YYYY-MM-DD format
  },
  queryCount: {
    type: Number,
    default: 0,
  },
  storageUsed: {
    type: Number,
    default: 0,
  },
  filesProcessed: {
    type: Number,
    default: 0,
  },
});

// Unique compound index to prevent duplicate records per user per day
usageTrackingSchema.index({ userId: 1, date: 1 }, { unique: true });

const UsageTracking = mongoose.model('UsageTracking', usageTrackingSchema);
module.exports = UsageTracking;
