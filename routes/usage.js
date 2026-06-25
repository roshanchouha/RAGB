const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const Source = require('../models/Source');
const UsageTracking = require('../models/UsageTracking');
const { PLAN_LIMITS } = require('../middleware/planLimits');

// GET /api/usage
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const plan = req.user.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    // Workspace count
    const workspaceCount = await Workspace.countDocuments({
      userId,
      isArchived: false,
    });

    // Total completed files
    const totalFiles = await Source.countDocuments({
      userId,
      processingStatus: 'completed',
    });

    // Daily query count
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = await UsageTracking.findOne({ userId, date: today });
    const dailyQueryCount = todayUsage ? todayUsage.queryCount : 0;

    // Total storage used (aggregate across all workspaces)
    const storageAgg = await Workspace.aggregate([
      {
        $match: { userId: new mongoose.Types.ObjectId(userId) },
      },
      {
        $group: {
          _id: null,
          storageUsed: { $sum: '$storageUsed' },
          totalChunks: { $sum: '$totalChunks' },
          totalQueries: { $sum: '$queryCount' },
        },
      },
    ]);

    const aggregated = storageAgg[0] || {
      storageUsed: 0,
      totalChunks: 0,
      totalQueries: 0,
    };

    return res.status(200).json({
      success: true,
      usage: {
        plan,
        workspaceCount,
        totalFiles,
        storageUsed: aggregated.storageUsed,
        totalChunks: aggregated.totalChunks,
        totalQueries: aggregated.totalQueries,
        dailyQueryCount,
      },
      limits: {
        workspaces: limits.workspaces === Infinity ? null : limits.workspaces,
        files: limits.files === Infinity ? null : limits.files,
        dailyQueries:
          limits.dailyQueries === Infinity ? null : limits.dailyQueries,
      },
      percentages: {
        workspaces:
          limits.workspaces === Infinity
            ? 0
            : Math.round((workspaceCount / limits.workspaces) * 100),
        files:
          limits.files === Infinity
            ? 0
            : Math.round((totalFiles / limits.files) * 100),
        dailyQueries:
          limits.dailyQueries === Infinity
            ? 0
            : Math.round((dailyQueryCount / limits.dailyQueries) * 100),
      },
    });
  } catch (error) {
    console.error('Get usage error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch usage data.',
    });
  }
});

module.exports = router;
