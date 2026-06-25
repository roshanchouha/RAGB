const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: [true, 'Chat ID is required'],
  },
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
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: [true, 'Role is required'],
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
  },
  sources: [
    {
      sourceId: String,
      sourceName: String,
      sourceType: String,
      sourceUrl: String,
      chunkIndex: Number,
      similarityScore: Number,
      textSnippet: String,
    },
  ],
  citations: [String],
  confidenceScore: {
    type: Number,
    min: 0,
    max: 1,
  },
  relatedSources: [String],
  tokensUsed: {
    type: Number,
  },
  processingTimeMs: {
    type: Number,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

messageSchema.index({ chatId: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
