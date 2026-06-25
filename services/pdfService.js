const pdfParse = require('pdf-parse');

/**
 * Extracts text from a PDF buffer.
 * @param {Buffer} buffer - The PDF file buffer
 * @returns {Promise<{ text: string, pageCount: number, metadata: object }>}
 */
async function extractPdfText(buffer) {
  try {
    const data = await pdfParse(buffer);

    return {
      text: data.text || '',
      pageCount: data.numpages || 0,
      metadata: {
        title: data.info?.Title || '',
        author: data.info?.Author || '',
        subject: data.info?.Subject || '',
        creator: data.info?.Creator || '',
        producer: data.info?.Producer || '',
        creationDate: data.info?.CreationDate || '',
        pdfVersion: data.info?.PDFFormatVersion || '',
      },
    };
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

module.exports = { extractPdfText };
