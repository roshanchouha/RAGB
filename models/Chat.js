const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: [true, 'Workspace ID is required'],
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  title: {
    type: String,
    default: 'New Chat',
    trim: true,
  },
  sourceFilter: {
    type: String,
    default: 'all', // 'all' or a specific sourceId string
  },
  messageCount: {
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

chatSchema.index({ workspaceId: 1, updatedAt: -1 });
chatSchema.index({ userId: 1 });

const Chat = mongoose.model('Chat', chatSchema);
module.exports = Chat;
