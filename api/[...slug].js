/**
 * Vercel Serverless Catch-All untuk seluruh rute /api/*
 * (pola native Vercel — tidak bergantung pada rewrite di vercel.json)
 *
 * Vercel menyerahkan sisa path sebagai array pada req.query.slug, mis.:
 *   /api/health            -> slug = ['health']
 *   /api/ollama/chat       -> slug = ['ollama', 'chat']
 *   /api/youtube-search?q= -> slug = ['youtube-search'], req.url membawa query
 *
 * File ini hanya "memulihkan" req.url lalu mendelegasikan ke gateway tunggal
 * di api/index.js (yang memuat engine server.js secara lazy + watchdog).
 */

const gateway = require('./index.js');

module.exports = async function handler(req, res) {
  try {
    const slug = req.query && req.query.slug;
    const parts = Array.isArray(slug) ? slug : (typeof slug === 'string' ? slug.split('/') : []);
    const cleaned = parts.filter(Boolean);
    const rawUrl = String(req.url || '');
    const qIdx = rawUrl.indexOf('?');
    const qs = qIdx >= 0 ? rawUrl.slice(qIdx) : '';
    if (cleaned.length) {
      req.url = '/api/' + cleaned.join('/') + qs;
    }
  } catch (_) {
    // biarkan req.url apa adanya; gateway akan memberi pesan 404 yang jelas
  }

  return gateway(req, res);
};
