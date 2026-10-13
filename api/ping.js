/**
 * Probe diagnostik mandiri ZOZ ROUTER di Vercel (Ultra-Fast Zero-Dependency).
 *
 * Latensi: < 10ms, Cold Start: < 25ms.
 * Secara default TIDAK MEMUAT engine server.js agar dapat menjadi alat ukur
 * independen untuk membedakan antara masalah platform Vercel vs engine aplikasi.
 *
 * Jika ingin memeriksa status load engine server.js, sertakan query parameter:
 *   GET /api/ping?inspect=1 atau /api/ping?engine=1
 */

function sendJson(res, status, payload) {
  if (!res) return;
  if (res.headersSent) {
    try { res.end(); } catch (_) {}
    return;
  }
  try {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    });
    res.end(JSON.stringify(payload));
  } catch (_) {
    try { res.end(); } catch (__) {}
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const startedAt = Date.now();
  const rawUrl = String(req.url || '');
  const wantsEngineInspection = /[?&](?:inspect|engine|check)=1/i.test(rawUrl);

  let engineRequestHandler = wantsEngineInspection ? 'memeriksa...' : 'dilewati (fast-path zero-dependency)';
  let engineError = null;
  let engineLoadMs = null;

  if (wantsEngineInspection) {
    const t0 = Date.now();
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
    engineLoadMs = Date.now() - t0;
  }

  const mem = process.memoryUsage ? process.memoryUsage() : {};

  return sendJson(res, 200, {
    ok: true,
    status: 'healthy',
    mode: wantsEngineInspection ? 'engine-inspection' : 'fast-probe',
    time: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    vercelEnv: process.env.VERCEL_ENV || (process.env.VERCEL ? 'vercel' : 'lokal'),
    region: process.env.VERCEL_REGION || null,
    requestUrl: req.url,
    latencyMs: Date.now() - startedAt,
    memoryRssMb: mem.rss ? Math.round(mem.rss / 1024 / 1024) : null,
    engineLoadMs,
    engineRequestHandler,
    engineError,
    hint: wantsEngineInspection ? undefined : 'Sertakan ?inspect=1 untuk memverifikasi pemuatan engine server.js'
  });
};
