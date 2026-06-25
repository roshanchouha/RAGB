const Workspace = require('../models/Workspace');
const Source = require('../models/Source');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { deleteVectorsBySource } = require('../services/pineconeService');
const { getPineconeIndex } = require('../config/pinecone');

/**
 * GET /api/workspaces
 */
const getWorkspaces = async (req, res) => {
  try {
    const workspaces = await Workspace.find({
      userId: req.user.id,
      isArchived: false,
    }).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: workspaces.length,
      workspaces,
    });
  } catch (error) {
    console.error('Get workspaces error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch workspaces.',
    });
  }
};

/**
 * POST /api/workspaces
 */
const createWorkspace = async (req, res) => {
  try {
    const { name, description, color, icon } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Workspace name is required.',
      });
    }

    const workspace = await Workspace.create({
      userId: req.user.id,
      name: name.trim(),
      description: description ? description.trim() : undefined,
      color: color || '#6366f1',
      icon: icon || 'brain',
    });

    return res.status(201).json({
      success: true,
      workspace,
    });
  } catch (error) {
    console.error('Create workspace error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(', '),
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create workspace.',
    });
  }
};

/**
 * GET /api/workspaces/:id
 */
const getWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found.',
      });
    }

    return res.status(200).json({
      success: true,
      workspace,
    });
  } catch (error) {
    console.error('Get workspace error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace.',
    });
  }
};

/**
 * PUT /api/workspaces/:id
 */
const updateWorkspace = async (req, res) => {
  try {
    const { name, description, color, icon } = req.body;

    const workspace = await Workspace.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found.',
      });
    }

    if (name !== undefined) workspace.name = name.trim();
    if (description !== undefined) workspace.description = description.trim();
    if (color !== undefined) workspace.color = color;
    if (icon !== undefined) workspace.icon = icon;
    workspace.updatedAt = new Date();

    await workspace.save();

    return res.status(200).json({
      success: true,
      workspace,
    });
  } catch (error) {
    console.error('Update workspace error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(', '),
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update workspace.',
    });
  }
};

/**
 * DELETE /api/workspaces/:id
 */
const deleteWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found.',
      });
    }

    const workspaceId = workspace._id.toString();

    // Delete all sources from MongoDB
    await Source.deleteMany({ workspaceId: workspace._id });

    // Delete all chats and messages from MongoDB
    const chats = await Chat.find({ workspaceId: workspace._id }).select('_id');
    const chatIds = chats.map((c) => c._id);
    await Message.deleteMany({ chatId: { $in: chatIds } });
    await Chat.deleteMany({ workspaceId: workspace._id });

    // Delete all vectors from Pinecone (delete entire namespace)
    try {
      const index = await getPineconeIndex();
      const namespace = index.namespace(workspaceId);
      await namespace.deleteAll();
    } catch (pineconeError) {
      console.error('Pinecone namespace delete error (non-fatal):', pineconeError.message);
    }

    // Delete workspace document
    await workspace.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Workspace and all its data deleted successfully.',
    });
  } catch (error) {
    console.error('Delete workspace error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete workspace.',
    });
  }
};

/**
 * GET /api/workspaces/:id/stats
 */
const getWorkspaceStats = async (req, res) => {
  try {
    const workspace = await Workspace.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found.',
      });
    }

    // Source breakdown by type
    const sourcesByType = await Source.aggregate([
      {
        $match: {
          workspaceId: workspace._id,
          processingStatus: 'completed',
        },
      },
      {
        $group: {
          _id: '$sourceType',
          count: { $sum: 1 },
          totalSize: { $sum: '$fileSize' },
          totalChunks: { $sum: '$chunkCount' },
        },
      },
    ]);

    const sources = await Source.find({ workspaceId: workspace._id })
      .select('sourceName sourceType processingStatus fileSize createdAt chunkCount vectorCount')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      stats: {
        sourceCount: workspace.sourceCount,
        storageUsed: workspace.storageUsed,
        totalChunks: workspace.totalChunks,
        totalVectors: workspace.totalVectors,
        queryCount: workspace.queryCount,
        sourcesByType,
        sources,
      },
    });
  } catch (error) {
    console.error('Get workspace stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace stats.',
    });
  }
};

module.exports = {
  getWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceStats,
};
