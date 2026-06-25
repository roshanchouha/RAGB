const { getPineconeIndex } = require('../config/pinecone');

/**
 * Upserts vectors to a Pinecone namespace (workspaceId).
 * @param {string} workspaceId
 * @param {Array<{ id: string, values: number[], metadata: object }>} vectors
 */
async function upsertVectors(workspaceId, vectors) {
  const index = await getPineconeIndex();
  const namespace = index.namespace(workspaceId.toString());

  // Pinecone recommends batches of 100 vectors max
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await namespace.upsert(batch);
  }
}

/**
 * Queries Pinecone vectors in a namespace.
 * @param {string} workspaceId
 * @param {number[]} queryVector
 * @param {number} topK
 * @param {object} filter - Optional metadata filter
 * @returns {Promise<Array>} matches
 */
async function queryVectors(workspaceId, queryVector, topK = 5, filter = {}) {
  const index = await getPineconeIndex();
  const namespace = index.namespace(workspaceId.toString());

  const queryOptions = {
    vector: queryVector,
    topK,
    includeMetadata: true,
    includeValues: false,
  };

  if (filter && Object.keys(filter).length > 0) {
    queryOptions.filter = filter;
  }

  const result = await namespace.query(queryOptions);
  return result.matches || [];
}

/**
 * Deletes all vectors for a specific source from a workspace namespace.
 * @param {string} workspaceId
 * @param {string} sourceId
 */
async function deleteVectorsBySource(workspaceId, sourceId) {
  const index = await getPineconeIndex();
  const namespace = index.namespace(workspaceId.toString());

  // Delete by metadata filter (requires Pinecone index to support metadata filtering)
  await namespace.deleteMany({ sourceId: { $eq: sourceId.toString() } });
}

module.exports = { upsertVectors, queryVectors, deleteVectorsBySource };
