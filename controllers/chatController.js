const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Workspace = require('../models/Workspace');
const UsageTracking = require('../models/UsageTracking');
const { queryKnowledgeBase } = require('../services/ragService');

/**
 * GET /api/workspaces/:wid/chats
 */
const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      workspaceId: req.params.wid,
      userId: req.user.id,
      isArchived: false,
    }).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: chats.length,
      chats,
    });
  } catch (error) {
    console.error('Get chats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch chats.' });
  }
};

/**
 * POST /api/workspaces/:wid/chats
 */
const createChat = async (req, res) => {
  try {
    const workspaceId = req.params.wid;
    const { title, sourceFilter } = req.body;

    // Verify workspace ownership
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      userId: req.user.id,
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    const chat = await Chat.create({
      workspaceId,
      userId: req.user.id,
      title: title ? title.trim() : 'New Chat',
      sourceFilter: sourceFilter || 'all',
    });

    return res.status(201).json({
      success: true,
      chat,
    });
  } catch (error) {
    console.error('Create chat error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create chat.' });
  }
};

/**
 * GET /api/workspaces/:wid/chats/:cid/messages
 */
const getMessages = async (req, res) => {
  try {
    // Verify chat ownership
    const chat = await Chat.findOne({
      _id: req.params.cid,
      userId: req.user.id,
    });

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    const messages = await Message.find({ chatId: req.params.cid })
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: messages.length,
      chat,
      messages,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
  }
};

/**
 * POST /api/workspaces/:wid/chats/:cid/messages
 */
const sendMessage = async (req, res) => {
  const startTime = Date.now();

  try {
    const { content } = req.body;
    const chatId = req.params.cid;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    // Verify chat ownership
    const chat = await Chat.findOne({
      _id: chatId,
      userId: req.user.id,
    });

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    const workspaceId = chat.workspaceId;

    // Save user message
    const userMessage = await Message.create({
      chatId,
      workspaceId,
      userId: req.user.id,
      role: 'user',
      content: content.trim(),
    });

    // Get recent chat history for context (last 6 messages)
    const recentMessages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .limit(7) // 7 to include the one we just saved, then exclude it
      .lean();

    // Exclude the user message we just saved (it's the last one)
    const chatHistory = recentMessages
      .filter((m) => m._id.toString() !== userMessage._id.toString())
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    // Run RAG pipeline
    const ragResult = await queryKnowledgeBase(
      workspaceId,
      content.trim(),
      chat.sourceFilter || 'all',
      chatHistory
    );

    const processingTimeMs = Date.now() - startTime;

    // Save assistant message
    const assistantMessage = await Message.create({
      chatId,
      workspaceId,
      userId: req.user.id,
      role: 'assistant',
      content: ragResult.answer,
      sources: ragResult.sources,
      citations: ragResult.citations,
      confidenceScore: ragResult.confidenceScore,
      relatedSources: ragResult.relatedSources,
      processingTimeMs,
    });

    // Update chat: message count and title (if first message)
    const updateData = {
      $inc: { messageCount: 2 },
      updatedAt: new Date(),
    };

    if (chat.messageCount === 0 && chat.title === 'New Chat') {
      updateData.title = content.trim().substring(0, 50);
    }

    await Chat.findByIdAndUpdate(chatId, updateData);

    // Increment workspace query count
    await Workspace.findByIdAndUpdate(workspaceId, {
      $inc: { queryCount: 1 },
      updatedAt: new Date(),
    });

    // Update daily usage tracking
    const today = new Date().toISOString().split('T')[0];
    await UsageTracking.findOneAndUpdate(
      { userId: req.user.id, date: today },
      { $inc: { queryCount: 1 } },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process message. Please try again.',
    });
  }
};

/**
 * DELETE /api/workspaces/:wid/chats/:cid
 */
const deleteChat = async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.cid,
      userId: req.user.id,
    });

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found.' });
    }

    // Delete all messages in the chat
    await Message.deleteMany({ chatId: chat._id });

    // Delete the chat itself
    await chat.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Chat deleted successfully.',
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete chat.' });
  }
};

module.exports = {
  getChats,
  createChat,
  getMessages,
  sendMessage,
  deleteChat,
};
