const Workspace = require('../models/Workspace');
const Source = require('../models/Source');
const UsageTracking = require('../models/UsageTracking');

const PLAN_LIMITS = {
  free: {
    workspaces: 3,
    files: 20,
    dailyQueries: 50,
  },
  pro: {
    workspaces: 50,
    files: 500,
    dailyQueries: Infinity,
  },
  enterprise: {
    workspaces: Infinity,
    files: Infinity,
    dailyQueries: Infinity,
  },
};

/**
 * Returns middleware that checks plan-based limits.
 * @param {'workspace' | 'file' | 'query'} limitType
 */
const checkPlanLimits = (limitType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const plan = req.user.plan || 'free';
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

      if (limitType === 'workspace') {
        if (limits.workspaces === Infinity) return next();

        const count = await Workspace.countDocuments({
          userId,
          isArchived: false,
        });

        if (count >= limits.workspaces) {
          return res.status(403).json({
            success: false,
            message: `Your ${plan} plan allows a maximum of ${limits.workspaces} workspace(s). Please upgrade to create more.`,
            limitType: 'workspace',
            limit: limits.workspaces,
            current: count,
          });
        }
      } else if (limitType === 'file') {
        if (limits.files === Infinity) return next();

        const count = await Source.countDocuments({
          userId,
          processingStatus: { $ne: 'failed' },
        });

        if (count >= limits.files) {
          return res.status(403).json({
            success: false,
            message: `Your ${plan} plan allows a maximum of ${limits.files} file(s). Please upgrade to add more.`,
            limitType: 'file',
            limit: limits.files,
            current: count,
          });
        }
      } else if (limitType === 'query') {
        if (limits.dailyQueries === Infinity) return next();

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const usage = await UsageTracking.findOne({ userId, date: today });
        const queryCount = usage ? usage.queryCount : 0;

        if (queryCount >= limits.dailyQueries) {
          return res.status(429).json({
            success: false,
            message: `You have reached your daily query limit of ${limits.dailyQueries} for the ${plan} plan. Try again tomorrow or upgrade your plan.`,
            limitType: 'query',
            limit: limits.dailyQueries,
            current: queryCount,
          });
        }
      } else {
        return next();
      }

      next();
    } catch (error) {
      console.error('Plan limits check error:', error);
      next(error);
    }
  };
};

module.exports = { checkPlanLimits, PLAN_LIMITS };
