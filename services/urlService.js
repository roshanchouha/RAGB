const axios = require('axios');
const cheerio = require('cheerio');

const SELECTORS_TO_REMOVE = [
  'script',
  'style',
  'nav',
  'footer',
  'header',
  'aside',
  '.ad',
  '.advertisement',
  '.sidebar',
  '.cookie',
  '.cookie-banner',
  '.cookie-notice',
  '.popup',
  '.modal',
  '.newsletter',
  '[role="banner"]',
  '[role="navigation"]',
  '[aria-hidden="true"]',
];

/**
 * Fetches a URL and extracts clean text content.
 * @param {string} url - The URL to fetch
 * @returns {Promise<{ title: string, text: string, url: string }>}
 */
async function fetchUrlContent(url) {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      maxRedirects: 5,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Remove unwanted elements
    SELECTORS_TO_REMOVE.forEach((selector) => {
      $(selector).remove();
    });

    // Extract title
    const title =
      $('title').text().trim() ||
      $('h1').first().text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      url;

    // Try to find the main content area
    const mainSelectors = ['main', 'article', '[role="main"]', '.content', '.main-content', '#content', '#main'];
    let contentElement = null;

    for (const sel of mainSelectors) {
      if ($(sel).length > 0) {
        contentElement = $(sel).first();
        break;
      }
    }

    // Fall back to body if no main content found
    if (!contentElement) {
      contentElement = $('body');
    }

    // Extract and clean text
    let text = contentElement
      .text()
      .replace(/\s+/g, ' ')         // collapse whitespace
      .replace(/\n{3,}/g, '\n\n')   // reduce multiple newlines
      .replace(/\t/g, ' ')          // replace tabs
      .trim();

    if (!text || text.length < 50) {
      // Last resort: get all body text
      text = $('body').text().replace(/\s+/g, ' ').trim();
    }

    return {
      title: title.substring(0, 500),
      text,
      url,
    };
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error(`Request timed out after 15 seconds for URL: ${url}`);
    }
    if (error.response) {
      throw new Error(
        `Failed to fetch URL (HTTP ${error.response.status}): ${url}`
      );
    }
    throw new Error(`Failed to fetch URL: ${error.message}`);
  }
}

module.exports = { fetchUrlContent };
