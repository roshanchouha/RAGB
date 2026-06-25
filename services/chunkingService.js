/**
 * Cleans and splits text into overlapping chunks for embedding.
 * @param {string} text - Raw text to chunk
 * @param {number} chunkSize - Target chunk size in characters (default 800)
 * @param {number} overlap - Overlap between chunks in characters (default 150)
 * @returns {Array<{ text: string, chunkIndex: number }>}
 */
function chunkText(text, chunkSize = 800, overlap = 150) {
  if (!text || typeof text !== 'string') return [];

  // Clean up the text
  const cleaned = text
    .replace(/\r\n/g, '\n')              // normalize line endings
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')            // collapse horizontal whitespace
    .replace(/\n{3,}/g, '\n\n')         // max 2 consecutive newlines
    .replace(/^\s+|\s+$/g, '')          // trim start/end
    .replace(/[^\S\n]+/g, ' ');         // collapse non-newline whitespace

  if (cleaned.length === 0) return [];

  const chunks = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < cleaned.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= cleaned.length) {
      // Last chunk — take everything remaining
      const chunkText = cleaned.slice(startIndex).trim();
      if (chunkText.length > 0) {
        chunks.push({ text: chunkText, chunkIndex });
      }
      break;
    }

    // Try to break at a sentence boundary (. ! ?)
    let breakPoint = endIndex;
    const sentenceEnd = cleaned.lastIndexOf('.', endIndex);
    const exclamEnd = cleaned.lastIndexOf('!', endIndex);
    const questEnd = cleaned.lastIndexOf('?', endIndex);
    const bestSentenceBreak = Math.max(sentenceEnd, exclamEnd, questEnd);

    // Only use sentence break if it's reasonably close to the desired end
    if (bestSentenceBreak > startIndex + chunkSize * 0.5) {
      breakPoint = bestSentenceBreak + 1;
    } else {
      // Fallback: break at whitespace
      const spaceBreak = cleaned.lastIndexOf(' ', endIndex);
      if (spaceBreak > startIndex) {
        breakPoint = spaceBreak;
      }
    }

    const chunkText = cleaned.slice(startIndex, breakPoint).trim();
    if (chunkText.length > 0) {
      chunks.push({ text: chunkText, chunkIndex });
      chunkIndex++;
    }

    // Move forward with overlap
    startIndex = breakPoint - overlap;
    if (startIndex < 0) startIndex = 0;

    // Prevent infinite loops if breakPoint didn't advance
    if (breakPoint <= startIndex + overlap) {
      startIndex = breakPoint + 1;
    }
  }

  return chunks;
}

module.exports = { chunkText };
