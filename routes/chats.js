const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access :wid
const authMiddleware = require('../middleware/auth');
const {
  getChats,
  createChat,
  getMessages,
  sendMessage,
  deleteChat,
} = require('../controllers/chatController');
const { checkPlanLimits } = require('../middleware/planLimits');

// Require authentication for all chat routes
router.use(authMiddleware);

// GET /api/workspaces/:wid/chats
router.get('/', getChats);

// POST /api/workspaces/:wid/chats
router.post('/', createChat);

// GET /api/workspaces/:wid/chats/:cid/messages
router.get('/:cid/messages', getMessages);

// POST /api/workspaces/:wid/chats/:cid/messages
router.post('/:cid/messages', checkPlanLimits('query'), sendMessage);

// DELETE /api/workspaces/:wid/chats/:cid
router.delete('/:cid', deleteChat);

module.exports = router;
