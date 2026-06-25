const { embeddingModel } = require('../config/gemini');

/**
 * Embeds a single text string using Gemini text-embedding-004.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedText(text) {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

/**
 * Embeds multiple texts in batches of 10 with rate-limit pausing.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function embedBatch(texts) {
  const results = [];
  const batchSize = 10;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await Promise.all(batch.map(embedText));
    results.push(...embeddings);

    // Rate limit pause between batches
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}

module.exports = { embedText, embedBatch };
