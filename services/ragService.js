const { embedText } = require('./embeddingService');
const { queryVectors } = require('./pineconeService');
const { generativeModel } = require('../config/gemini');
const Source = require('../models/Source');

/**
 * Main RAG pipeline: embeds the question, retrieves context from Pinecone,
 * enriches with MongoDB metadata, and generates a grounded answer via Gemini.
 *
 * @param {string} workspaceId
 * @param {string} question
 * @param {string} sourceFilter - 'all' or a specific sourceId
 * @param {Array<{ role: string, content: string }>} chatHistory - last N messages
 * @returns {Promise<{
 *   answer: string,
 *   sources: Array,
 *   citations: string[],
 *   confidenceScore: number,
 *   relatedSources: string[]
 * }>}
 */
async function queryKnowledgeBase(
  workspaceId,
  question,
  sourceFilter = 'all',
  chatHistory = []
) {
  // 1. Embed the user question
  const queryVector = await embedText(question);

  // 2. Build Pinecone filter if sourceFilter is set
  const filter =
    sourceFilter !== 'all' ? { sourceId: { $eq: sourceFilter.toString() } } : {};

  // 3. Query Pinecone for top 5 relevant chunks
  const matches = await queryVectors(workspaceId, queryVector, 5, filter);

  if (!matches || matches.length === 0) {
    return {
      answer:
        "I couldn't find any relevant information in the knowledge base to answer your question. Please make sure you have added sources to this workspace.",
      sources: [],
      citations: [],
      confidenceScore: 0,
      relatedSources: [],
    };
  }

  // 4. Enrich matches with MongoDB source metadata
  const sourceIds = [
    ...new Set(matches.map((m) => m.metadata?.sourceId).filter(Boolean)),
  ];
  const sourceDocs = await Source.find({ _id: { $in: sourceIds } }).lean();
  const sourceMap = {};
  sourceDocs.forEach((s) => {
    sourceMap[s._id.toString()] = s;
  });

  // 5. Build context from matched chunks
  const contextChunks = matches.map((match, idx) => {
    const meta = match.metadata || {};
    const sourceDoc = sourceMap[meta.sourceId] || null;
    const sourceName = sourceDoc?.sourceName || meta.sourceName || 'Unknown Source';
    const sourceType = sourceDoc?.sourceType || meta.sourceType || 'unknown';
    return `[Source ${idx + 1}: ${sourceName} (${sourceType})]\n${meta.text || ''}`;
  });

  const contextText = contextChunks.join('\n\n---\n\n');

  // 6. Build chat history string (last 6 messages)
  const recentHistory = chatHistory.slice(-6);
  const historyText =
    recentHistory.length > 0
      ? recentHistory
          .map(
            (msg) =>
              `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
          )
          .join('\n')
      : '';

  // 7. Construct the prompt
  const prompt = `You are an AI assistant for a knowledge base platform. Your job is to answer questions based ONLY on the context provided below.

STRICT RULES:
- Answer ONLY using information from the provided context.
- If the answer is not found in the context, clearly say: "I don't have enough information in the knowledge base to answer this question."
- Always cite your sources by mentioning the document name (e.g., "According to [Source Name]...").
- Be concise, accurate, and helpful.
- Do not fabricate or assume information beyond what is provided.

${historyText ? `CONVERSATION HISTORY:\n${historyText}\n` : ''}
CONTEXT FROM KNOWLEDGE BASE:
${contextText}

QUESTION: ${question}

ANSWER:`;

  // 8. Generate answer with Gemini
  const result = await generativeModel.generateContent(prompt);
  const answer = result.response.text();

  // 9. Calculate confidence score from average similarity scores
  const similarities = matches
    .map((m) => m.score || 0)
    .filter((s) => s > 0);
  const avgSimilarity =
    similarities.length > 0
      ? similarities.reduce((a, b) => a + b, 0) / similarities.length
      : 0;
  const confidenceScore = Math.min(1, Math.max(0, avgSimilarity));

  // 10. Build sources array for response
  const sources = matches.map((match) => {
    const meta = match.metadata || {};
    const sourceDoc = sourceMap[meta.sourceId] || null;
    return {
      sourceId: meta.sourceId || '',
      sourceName: sourceDoc?.sourceName || meta.sourceName || 'Unknown Source',
      sourceType: sourceDoc?.sourceType || meta.sourceType || 'unknown',
      sourceUrl: sourceDoc?.sourceUrl || meta.sourceUrl || null,
      chunkIndex: meta.chunkIndex !== undefined ? Number(meta.chunkIndex) : 0,
      similarityScore: match.score || 0,
      textSnippet: (meta.text || '').substring(0, 300),
    };
  });

  // 11. Build citations (unique source names)
  const citations = [
    ...new Set(sources.map((s) => s.sourceName).filter(Boolean)),
  ];

  // 12. Build related sources (source IDs)
  const relatedSources = [...new Set(sources.map((s) => s.sourceId).filter(Boolean))];

  return {
    answer,
    sources,
    citations,
    confidenceScore,
    relatedSources,
  };
}

module.exports = { queryKnowledgeBase };
