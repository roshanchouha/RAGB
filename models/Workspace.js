const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Workspace name is required'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
    trim: true,
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    trim: true,
  },
  color: {
    type: String,
    default: '#6366f1',
  },
  icon: {
    type: String,
    default: 'brain',
  },
  sourceCount: {
    type: Number,
    default: 0,
  },
  storageUsed: {
    type: Number,
    default: 0, // in bytes
  },
  totalChunks: {
    type: Number,
    default: 0,
  },
  totalVectors: {
    type: Number,
    default: 0,
  },
  queryCount: {
    type: Number,
    default: 0,
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

workspaceSchema.index({ userId: 1, updatedAt: -1 });

const Workspace = mongoose.model('Workspace', workspaceSchema);
module.exports = Workspace;
