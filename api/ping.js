/**
 * Probe diagnostik ZOZ ROUTER di Vercel (tanpa dependensi engine).
 *
 * Tujuan: memisahkan dua kemungkinan saat muncul 500 FUNCTION_INVOCATION_FAILED:
 *   1) Platform Vercel / routing rusak  -> /api/ping juga gagal.
 *   2) Engine server.js gagal dimuat    -> /api/ping tetap 200, tapi
 *      field engineRequestHandler berisi pesan errornya.
 *
 * Buka: https://<domain-anda>.vercel.app/api/ping
 */

function sendJson(res, status, payload) {
  if (res.headersSent) {
    try { res.end(); } catch (_) {}
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const startedAt = Date.now();
  let engineRequestHandler = 'belum dicek';
  let engineError = null;
  try {
    const engine = require('../server.js');
    engineRequestHandler = typeof (engine && engine.requestHandler);
    if (engineRequestHandler !== 'function') {
      engineError = 'server.js tidak mengekspor requestHandler';
    }
  } catch (err) {
    engineRequestHandler = 'error';
    engineError = err && err.message ? err.message : String(err);
  }

  sendJson(res, engineError ? 200 : 200, {
    ok: true,
    time: new Date().toISOString(),
    node: process.version,
    vercelEnv: process.env.VERCEL_ENV || (process.env.VERCEL ? 'vercel' : 'lokal'),
    region: process.env.VERCEL_REGION || null,
    requestUrl: req.url,
    engineLoadMs: Date.now() - startedAt,
    engineRequestHandler: engineRequestHandler,
    engineError: engineError
  });
};
