const Source = require('../models/Source');
const Workspace = require('../models/Workspace');
const { extractPdfText } = require('../services/pdfService');
const { extractDocxText } = require('../services/docxService');
const { fetchUrlContent } = require('../services/urlService');
const { chunkText } = require('../services/chunkingService');
const { embedBatch } = require('../services/embeddingService');
const { upsertVectors, deleteVectorsBySource } = require('../services/pineconeService');

/**
 * GET /api/workspaces/:wid/sources
 */
const getSources = async (req, res) => {
  try {
    const sources = await Source.find({
      workspaceId: req.params.wid,
      userId: req.user.id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: sources.length,
      sources,
    });
  } catch (error) {
    console.error('Get sources error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sources.' });
  }
};

/**
 * Async file processing pipeline (runs in background after response is sent).
 */
async function processFileAsync(source, file) {
  try {
    // Mark as processing
    source.processingStatus = 'processing';
    source.processingStartedAt = new Date();
    await source.save();

    // 1. Extract text based on file type
    let extractedText = '';
    const ext = file.originalname.split('.').pop().toLowerCase();

    if (ext === 'pdf' || source.mimeType === 'application/pdf') {
      const result = await extractPdfText(file.buffer);
      extractedText = result.text;
    } else if (['doc', 'docx'].includes(ext)) {
      const result = await extractDocxText(file.buffer);
      extractedText = result.text;
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    if (!extractedText || extractedText.trim().length < 10) {
      throw new Error('No readable text could be extracted from this file.');
    }

    // 2. Chunk the text
    const chunks = chunkText(extractedText);

    if (chunks.length === 0) {
      throw new Error('Text chunking produced no chunks.');
    }

    // 3. Embed all chunks
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedBatch(chunkTexts);

    // 4. Build vectors for Pinecone
    const vectors = chunks.map((chunk, i) => ({
      id: `${source._id.toString()}-chunk-${chunk.chunkIndex}`,
      values: embeddings[i],
      metadata: {
        sourceId: source._id.toString(),
        sourceName: source.sourceName,
        sourceType: source.sourceType,
        workspaceId: source.workspaceId.toString(),
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
      },
    }));

    // 5. Upsert to Pinecone
    await upsertVectors(source.workspaceId.toString(), vectors);

    // 6. Update source record
    source.processingStatus = 'completed';
    source.processingCompletedAt = new Date();
    source.chunkCount = chunks.length;
    source.vectorCount = vectors.length;
    await source.save();

    // 7. Update workspace stats
    await Workspace.findByIdAndUpdate(source.workspaceId, {
      $inc: {
        sourceCount: 1,
        storageUsed: file.size || 0,
        totalChunks: chunks.length,
        totalVectors: vectors.length,
      },
      updatedAt: new Date(),
    });

    console.log(`✅ Processed file: ${source.sourceName} (${chunks.length} chunks)`);
  } catch (error) {
    console.error(`❌ Failed to process file ${source.sourceName}:`, error.message);
    source.processingStatus = 'failed';
    source.processingError = error.message;
    await source.save();
  }
}

/**
 * Async URL processing pipeline (runs in background after response is sent).
 */
async function processUrlAsync(source, url) {
  try {
    source.processingStatus = 'processing';
    source.processingStartedAt = new Date();
    await source.save();

    // 1. Fetch URL content
    const { title, text } = await fetchUrlContent(url);

    if (!text || text.trim().length < 10) {
      throw new Error('No readable text could be extracted from this URL.');
    }

    // 2. Chunk the text
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error('Text chunking produced no chunks.');
    }

    // 3. Embed
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedBatch(chunkTexts);

    // 4. Build vectors
    const vectors = chunks.map((chunk, i) => ({
      id: `${source._id.toString()}-chunk-${chunk.chunkIndex}`,
      values: embeddings[i],
      metadata: {
        sourceId: source._id.toString(),
        sourceName: source.sourceName,
        sourceType: 'url',
        sourceUrl: url,
        workspaceId: source.workspaceId.toString(),
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
      },
    }));

    // 5. Upsert to Pinecone
    await upsertVectors(source.workspaceId.toString(), vectors);

    // 6. Update source
    source.processingStatus = 'completed';
    source.processingCompletedAt = new Date();
    source.chunkCount = chunks.length;
    source.vectorCount = vectors.length;
    // Approximate storage: text byte size
    const textByteSize = Buffer.byteLength(text, 'utf8');
    source.fileSize = textByteSize;
    await source.save();

    // 7. Update workspace stats
    await Workspace.findByIdAndUpdate(source.workspaceId, {
      $inc: {
        sourceCount: 1,
        storageUsed: textByteSize,
        totalChunks: chunks.length,
        totalVectors: vectors.length,
      },
      updatedAt: new Date(),
    });

    console.log(`✅ Processed URL: ${url} (${chunks.length} chunks)`);
  } catch (error) {
    console.error(`❌ Failed to process URL ${url}:`, error.message);
    source.processingStatus = 'failed';
    source.processingError = error.message;
    await source.save();
  }
}

/**
 * POST /api/workspaces/:wid/sources/upload
 */
const uploadFiles = async (req, res) => {
  try {
    const workspaceId = req.params.wid;

    // Verify workspace ownership
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      userId: req.user.id,
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded.' });
    }

    // Create source records immediately
    const createdSources = [];
    for (const file of req.files) {
      const ext = file.originalname.split('.').pop().toLowerCase();
      let sourceType = 'pdf';
      if (['doc', 'docx'].includes(ext)) sourceType = 'docx';

      const source = await Source.create({
        workspaceId,
        userId: req.user.id,
        sourceType,
        sourceName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        processingStatus: 'pending',
      });

      createdSources.push(source);

      // Process asynchronously (do not await)
      processFileAsync(source, file);
    }

    return res.status(202).json({
      success: true,
      message: `${createdSources.length} file(s) accepted for processing.`,
      sources: createdSources.map((s) => ({
        id: s._id,
        sourceName: s.sourceName,
        sourceType: s.sourceType,
        processingStatus: s.processingStatus,
      })),
    });
  } catch (error) {
    console.error('Upload files error:', error);
    if (error.message && error.message.includes('Invalid file type')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'File upload failed.' });
  }
};

/**
 * POST /api/workspaces/:wid/sources/url
 */
const addUrl = async (req, res) => {
  try {
    const workspaceId = req.params.wid;
    const { url, name } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, message: 'URL is required.' });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid URL format.' });
    }

    // Verify workspace ownership
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      userId: req.user.id,
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    const sourceName = name ? name.trim() : url;

    const source = await Source.create({
      workspaceId,
      userId: req.user.id,
      sourceType: 'url',
      sourceName,
      sourceUrl: url,
      processingStatus: 'pending',
    });

    // Process asynchronously
    processUrlAsync(source, url);

    return res.status(202).json({
      success: true,
      message: 'URL accepted for processing.',
      source: {
        id: source._id,
        sourceName: source.sourceName,
        sourceType: source.sourceType,
        sourceUrl: source.sourceUrl,
        processingStatus: source.processingStatus,
      },
    });
  } catch (error) {
    console.error('Add URL error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add URL.' });
  }
};

/**
 * DELETE /api/workspaces/:wid/sources/:sid
 */
const deleteSource = async (req, res) => {
  try {
    const source = await Source.findOne({
      _id: req.params.sid,
      userId: req.user.id,
      workspaceId: req.params.wid,
    });

    if (!source) {
      return res.status(404).json({ success: false, message: 'Source not found.' });
    }

    // Delete vectors from Pinecone
    try {
      await deleteVectorsBySource(source.workspaceId.toString(), source._id.toString());
    } catch (pineconeError) {
      console.error('Pinecone delete error (non-fatal):', pineconeError.message);
    }

    // Update workspace stats
    const isCompleted = source.processingStatus === 'completed';
    await Workspace.findByIdAndUpdate(source.workspaceId, {
      $inc: {
        sourceCount: isCompleted ? -1 : 0,
        storageUsed: isCompleted ? -(source.fileSize || 0) : 0,
        totalChunks: isCompleted ? -(source.chunkCount || 0) : 0,
        totalVectors: isCompleted ? -(source.vectorCount || 0) : 0,
      },
      updatedAt: new Date(),
    });

    await source.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Source deleted successfully.',
    });
  } catch (error) {
    console.error('Delete source error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete source.' });
  }
};

/**
 * GET /api/workspaces/:wid/sources/:sid/status
 */
const getSourceStatus = async (req, res) => {
  try {
    const source = await Source.findOne({
      _id: req.params.sid,
      userId: req.user.id,
      workspaceId: req.params.wid,
    });

    if (!source) {
      return res.status(404).json({ success: false, message: 'Source not found.' });
    }

    return res.status(200).json({
      success: true,
      source: {
        id: source._id,
        sourceName: source.sourceName,
        sourceType: source.sourceType,
        processingStatus: source.processingStatus,
        processingError: source.processingError,
        chunkCount: source.chunkCount,
        vectorCount: source.vectorCount,
        processingStartedAt: source.processingStartedAt,
        processingCompletedAt: source.processingCompletedAt,
      },
    });
  } catch (error) {
    console.error('Get source status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get source status.' });
  }
};

module.exports = {
  getSources,
  uploadFiles,
  addUrl,
  deleteSource,
  getSourceStatus,
};
