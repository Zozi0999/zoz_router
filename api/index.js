/**
 * Vercel Serverless Function Gateway for ZOZ ROUTER
 * Routes all /api/* requests through the monolithic server.js engine
 */

const { requestHandler } = require('../server.js');

module.exports = async function handler(req, res) {
  // Set CORS Headers upfront
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ollama-endpoint, x-title, HTTP-Referer, x-serper-key, x-ollama-key, x-api-key, x-openrouter-key, x-session-id, X-Session-ID');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Restore original request URL if rewritten by Vercel
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || req.headers['x-original-url'];
  if (matchedPath && matchedPath.startsWith('/api') && (req.url === '/api' || req.url === '/api/')) {
    req.url = matchedPath;
  }

  try {
    await requestHandler(req, res);
  } catch (err) {
    console.error('[Vercel Gateway Error]:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Internal Server Error on Vercel Gateway', details: err?.message || String(err) }));
    } else {
      try { res.end(); } catch (_) {}
    }
  }
};
