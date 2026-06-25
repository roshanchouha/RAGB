const mammoth = require('mammoth');

/**
 * Extracts text from a DOCX buffer using mammoth.
 * @param {Buffer} buffer - The DOCX file buffer
 * @returns {Promise<{ text: string, messages: Array }>}
 */
async function extractDocxText(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });

    return {
      text: result.value || '',
      messages: result.messages || [],
    };
  } catch (error) {
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
  }
}

module.exports = { extractDocxText };
