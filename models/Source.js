const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
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
  sourceType: {
    type: String,
    enum: ['pdf', 'docx', 'url'],
    required: [true, 'Source type is required'],
  },
  sourceName: {
    type: String,
    required: [true, 'Source name is required'],
    trim: true,
  },
  sourceUrl: {
    type: String, // for url type
  },
  fileSize: {
    type: Number,
    default: 0,
  },
  mimeType: {
    type: String,
  },
  chunkCount: {
    type: Number,
    default: 0,
  },
  vectorCount: {
    type: Number,
    default: 0,
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  processingError: {
    type: String,
  },
  processingStartedAt: {
    type: Date,
  },
  processingCompletedAt: {
    type: Date,
  },
  metadata: {
    type: Map,
    of: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

sourceSchema.index({ workspaceId: 1 });
sourceSchema.index({ userId: 1 });

const Source = mongoose.model('Source', sourceSchema);
module.exports = Source;
