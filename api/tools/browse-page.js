// ============================================================================
// Vercel Serverless Function: Autonomous Web Browse & Page Reading Tool
// Kompatibel dengan pemanggilan /api/tools/browse-page
// ============================================================================

const extractWebHandler = require('../extract-web');

module.exports = async function handler(req, res) {
  // Teruskan pemanggilan ke handler extract-web
  return extractWebHandler(req, res);
};
