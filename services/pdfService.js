const pdfParse = require('pdf-parse');
const { generativeModel } = require('../config/gemini');

/**
 * Extracts text from a PDF buffer. Falls back to Gemini OCR for scanned/image-only PDFs.
 * @param {Buffer} buffer - The PDF file buffer
 * @returns {Promise<{ text: string, pageCount: number, metadata: object }>}
 */
async function extractPdfText(buffer) {
  try {
    const data = await pdfParse(buffer);
    let text = data.text || '';

    // Clean text to check actual length (ignoring whitespace and newlines)
    const cleanedTextLength = text.trim().replace(/\s+/g, '').length;

    // If no readable text or too short (scanned PDF / image-only), use Gemini OCR fallback
    if (cleanedTextLength < 10) {
      console.log('⚠️ pdf-parse extracted little to no text. Falling back to Gemini Multimodal OCR...');
      try {
        const response = await generativeModel.generateContent([
          {
            inlineData: {
              data: buffer.toString('base64'),
              mimeType: 'application/pdf'
            }
          },
          'Extract all readable text from this PDF document verbatim. If it contains tables, transcribe them as clean markdown tables. Do not summarize, explain, or add any commentary. Just return the extracted text.'
        ]);
        
        const geminiText = response.response.text();
        if (geminiText && geminiText.trim().length >= 10) {
          text = geminiText;
          console.log(`✅ Successfully extracted text via Gemini OCR fallback (${text.length} chars).`);
        }
      } catch (geminiError) {
        console.error('❌ Gemini OCR fallback failed:', geminiError.message);
      }
    }

    return {
      text,
      pageCount: data.numpages || 1,
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
    console.log('⚠️ pdf-parse failed. Attempting Gemini Multimodal OCR directly...');
    try {
      const response = await generativeModel.generateContent([
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: 'application/pdf'
          }
        },
        'Extract all readable text from this PDF document verbatim. If it contains tables, transcribe them as clean markdown tables. Do not summarize, explain, or add any commentary. Just return the extracted text.'
      ]);
      
      const geminiText = response.response.text();
      if (geminiText && geminiText.trim().length >= 10) {
        console.log(`✅ Successfully extracted text via Gemini OCR fallback after parse error (${geminiText.length} chars).`);
        return {
          text: geminiText,
          pageCount: 1,
          metadata: { title: 'Extracted PDF (Gemini)' },
        };
      }
    } catch (geminiError) {
      console.error('❌ Gemini OCR fallback after parse error failed:', geminiError.message);
    }
    
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

module.exports = { extractPdfText };
