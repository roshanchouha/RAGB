const { Pinecone } = require('@pinecone-database/pinecone');

if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY is not set in environment variables');
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const getPineconeIndex = async () => {
  const indexName = process.env.PINECONE_INDEX_NAME;
  if (!indexName) {
    throw new Error('PINECONE_INDEX_NAME is not set in environment variables');
  }
  return pinecone.index(indexName);
};

module.exports = { getPineconeIndex };
