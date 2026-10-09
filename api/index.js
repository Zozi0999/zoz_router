/**
 * Vercel Serverless Function Gateway for ZOZ ROUTER
 * Routes all /api/* requests through the monolithic server.js engine.
 *
 * Ketahanan:
 * - require('../server.js') dilakukan LAZY di dalam try/catch, sehingga bila
 *   engine gagal dimuat (bundle hilang, dsb) user mendapat pesan JSON yang jelas
 *   alih-alih halaman500 "FUNCTION_INVOCATION_FAILED" yang tidak informatif.
 * - Watchdog: bila requestHandler tidak pernah menyelesaikan respons, gateway
 *   mengirim 504 daripada menggantung sampai dibunuh platform.
 */

const WATCHDOG_MS = 10000;

function sendJson(res, status, payload) {
  if (!res) return;
  if (res.headersSent) {
    try { res.end(); } catch (_) {}
    return;
  }
  try {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
  } catch (_) {
    try { res.end(); } catch (__) {}
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ollama-endpoint, x-title, HTTP-Referer, x-serper-key, x-ollama-key, x-api-key, x-openrouter-key, x-session-id, X-Session-ID');
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Vercel meng-rewrite /api/<semua> ke /api/index — pulihkan path aslinya
  // supaya requestHandler bisa mencocokkan rute (/api/health, /api/youtube-search, ...).
  // Penting: req.url setelah rewrite MEMBAWA query string ("/api/index?q=..."),
  // jadi pencocokannya harus dibandingkan pada PATH-nya saja.
  try {
    const rawUrl = String(req.url || '');
    const qIdx = rawUrl.indexOf('?');
    const currentPath = qIdx >= 0 ? rawUrl.slice(0, qIdx) : rawUrl;
    const currentQuery = qIdx >= 0 ? rawUrl.slice(qIdx) : '';

    const isRestorable = (currentPath === '/api' || currentPath === '/api/' || currentPath === '/api/index');
    if (isRestorable) {
      const hdrs = req.headers || {};
      const candidates = [hdrs['x-matched-path'], hdrs['x-forwarded-uri'], hdrs['x-original-url'], hdrs['x-vercel-original-path']];
      let originalPath = '';
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        if (!c || typeof c !== 'string') continue;
        const ci = c.indexOf('?');
        const cp = ci >= 0 ? c.slice(0, ci) : c;
        // Lewati bila header ternyata menunjuk destinasi (bukan path API asli).
        if (cp.indexOf('/api/') === 0 && cp !== '/api/index' && cp !== '/api') { originalPath = cp; break; }
      }
      // Fallback: rekonstruksi dari query bila tersedia (bentuk ?slug[]=health)
      if (!originalPath && req.query && typeof req.query === 'object') {
        const slug = req.query.slug || req.query.path || req.query.all;
        const parts = Array.isArray(slug) ? slug : (typeof slug === 'string' ? slug.split('/') : []);
        const cleaned = parts.filter(Boolean);
        if (cleaned.length) originalPath = '/api/' + cleaned.join('/');
      }
      if (originalPath) req.url = originalPath + currentQuery;
    }
  } catch (_) {}

  // Probe diagnostik — ditangani gateway agar tetap hidup walau rewrite
  // mengarahkan /api/ping ke endpoint ini.
  if (String(req.url || '').split('?')[0] === '/api/ping') {
    let engineStatus = 'lazy (belum dimuat)';
    let engineError = null;
    const t0 = Date.now();
    try {
      engineStatus = typeof (require('../server.js') || {}).requestHandler;
    } catch (e) {
      engineStatus = 'error';
      engineError = e && e.message ? e.message : String(e);
    }
    return sendJson(res, 200, {
      ok: true,
      time: new Date().toISOString(),
      node: process.version,
      vercelEnv: process.env.VERCEL_ENV || (process.env.VERCEL ? 'vercel' : 'lokal'),
      region: process.env.VERCEL_REGION || null,
      requestUrl: req.url,
      engineLoadMs: Date.now() - t0,
      engineRequestHandler: engineStatus,
      engineError: engineError
    });
  }

  const startedAt = Date.now();
  let finished = false;
  const watchdog = setTimeout(() => {
    if (finished) return;
    finished = true;
    console.error('[Vercel Gateway] Timeout ' + WATCHDOG_MS + 'ms untuk ' + (req && req.url ? req.url : '?'));
    sendJson(res, 504, {
      error: 'Gateway timeout: requestHandler tidak menyelesaikan respons dalam ' + WATCHDOG_MS + 'ms.',
      path: req && req.url ? req.url : null,
      hint: 'Buka /api/ping untuk memisahkan masalah platform vs engine.'
    });
  }, WATCHDOG_MS);

  let requestHandler = null;
  try {
    const engine = require('../server.js');
    requestHandler = engine && engine.requestHandler;
    if (typeof requestHandler !== 'function') {
      throw new Error('server.js tidak mengekspor requestHandler (typeof=' + typeof requestHandler + ')');
    }
  } catch (err) {
    finished = true;
    clearTimeout(watchdog);
    console.error('[Vercel Gateway] Gagal memuat engine server.js:', err);
    return sendJson(res, 500, {
      error: 'Gagal memuat engine ZOZ Router',
      details: err && err.message ? err.message : String(err),
      stack: (err && err.stack ? String(err.stack) : '').split('\n').slice(0, 6),
      node: process.version,
      vercel: !!process.env.VERCEL
    });
  }

  try {
    await requestHandler(req, res);
  } catch (err) {
    console.error('[Vercel Gateway Error] ' + (req && req.url ? req.url : '?') + ' setelah ' + (Date.now() - startedAt) + 'ms:', err);
    sendJson(res, 500, {
      error: 'Internal Server Error on Vercel Gateway',
      details: err && err.message ? err.message : String(err),
      stack: (err && err.stack ? String(err.stack) : '').split('\n').slice(0, 8)
    });
  } finally {
    finished = true;
    clearTimeout(watchdog);
  }
};
