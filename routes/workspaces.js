const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceStats,
} = require('../controllers/workspaceController');
const { checkPlanLimits } = require('../middleware/planLimits');

// Import nested routers
const sourcesRouter = require('./sources');
const chatsRouter = require('./chats');

// All workspace routes require authentication
router.use(authMiddleware);

// GET /api/workspaces
router.get('/', getWorkspaces);

// POST /api/workspaces
router.post('/', checkPlanLimits('workspace'), createWorkspace);

// GET /api/workspaces/:id
router.get('/:id', getWorkspace);

// PUT /api/workspaces/:id
router.put('/:id', updateWorkspace);

// DELETE /api/workspaces/:id
router.delete('/:id', deleteWorkspace);

// GET /api/workspaces/:id/stats
router.get('/:id/stats', getWorkspaceStats);

// Nested: /api/workspaces/:wid/sources
router.use('/:wid/sources', sourcesRouter);

// Nested: /api/workspaces/:wid/chats
router.use('/:wid/chats', chatsRouter);

module.exports = router;
