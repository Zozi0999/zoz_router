/**
 * Vercel Serverless Function Native Catch-All Gateway for ZOZ ROUTER
 * File: api/[...slug].js
 *
 * Arsitektur:
 * 1. Native Catch-All Dynamic Routing:
 *    Platform Vercel secara native meneruskan URL dan query asli tanpa memerlukan
 *    rewrite manual dan tanpa memotong / merusak parameter kueri sah pengguna (seperti `path` atau `slug`).
 * 2. Synchronized Adaptive Watchdog:
 *    Nilai watchdog dikaitkan langsung dengan `maxDuration` di `vercel.json` (rumus: maxDuration - 2 detik),
 *    sehingga gateway selalu menembak lebih dulu mengembalikan respons JSON 504 sebelum platform Vercel memotong paksa koneksi.
 * 3. Multi-Tier Edge Caching Layer:
 *    Secara otomatis menginjeksi header CDN Edge Vercel (Cache-Control: s-maxage) untuk kueri pencarian berulang,
 *    serta mendukung integrasi Upstash Redis REST KV (zero external dependency).
 * 4. Streaming SSE Anti-Buffering:
 *    Mendukung respons real-time Server-Sent Events tanpa buffering proxy.
 */

// 1. Perhitungan Dinamis Watchdog Berdasarkan Environment Variable & vercel.json
let configuredMaxDuration = 60;

// Sumber utama: Environment Variable (selalu ada di runtime bundle tanpa bergantung pada sistem berkas)
if (process.env.VERCEL_MAX_DURATION) {
  const parsedEnv = Number(process.env.VERCEL_MAX_DURATION);
  if (!isNaN(parsedEnv) && parsedEnv > 0) configuredMaxDuration = parsedEnv;
} else {
  // Fallback sekunder: Coba baca konfigurasi vercel.json bila berkas terangkut di deployment bundle
  try {
    const vercelCfg = require('../vercel.json');
    configuredMaxDuration =
      Number(vercelCfg?.functions?.['api/[...slug].js']?.maxDuration) ||
      Number(vercelCfg?.functions?.['api/index.js']?.maxDuration) ||
      Number(vercelCfg?.functions?.['api/**/*.js']?.maxDuration) || 60;
  } catch (_) {
    configuredMaxDuration = 60;
  }
}

// Rumus: maxDuration - 2 detik (Floor minimal 8 detik untuk pre-emptive defense)
const dynamicWatchdogSec = Math.max(configuredMaxDuration - 2, 8);
const WATCHDOG_MS = Number(process.env.GATEWAY_WATCHDOG_MS) || (dynamicWatchdogSec * 1000);

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

function setCorsHeaders(req, res) {
  const origin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ollama-endpoint, x-title, HTTP-Referer, x-serper-key, x-ollama-key, x-api-key, x-openrouter-key, x-session-id, X-Session-ID, x-user-id, X-User-ID, x-client-id, X-Client-ID, x-user-token, X-User-Token');
}

// Helper Upstash Redis REST Caching (Zero-Dependency)
async function getUpstashCache(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !key) return null;
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(1500)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.result ? JSON.parse(data.result) : null;
  } catch (_) {
    return null;
  }
}

async function setUpstashCache(key, value, exSeconds = 3600) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !key || !value) return;
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}?EX=${exSeconds}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(1500)
    });
  } catch (_) {}
}

module.exports = async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const rawUrl = String(req.url || '');
  const pathname = rawUrl.split('?')[0];

  // 1. Fast-Path Probe Diagnostik Ping
  if (pathname === '/api/ping') {
    const pingHandler = require('./ping.js');
    return pingHandler(req, res);
  }

  // 2. Caching Layer untuk Kueri Penelusuran Publik GET (Vercel Edge Network CDN)
  if (req.method === 'GET') {
    const reqHeaders = req.headers || {};
    const hasUserSpecificHeaders = Boolean(
      reqHeaders.authorization ||
      reqHeaders['x-user-id'] ||
      reqHeaders['x-api-key'] ||
      reqHeaders['x-serper-key'] ||
      reqHeaders['x-openrouter-key'] ||
      reqHeaders['x-ollama-key']
    );

    if (hasUserSpecificHeaders) {
      // Jika memuat kredensial atau identitas spesifik: cegah cache pollution lintas pengguna di Edge CDN
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Vary', 'Accept-Encoding, Authorization, x-user-id, x-api-key, x-serper-key, x-openrouter-key, x-ollama-key');
    } else {
      // Murni kueri publik anonim bersama: aman di-cache di Vercel Edge CDN
      res.setHeader('Vary', 'Accept-Encoding');
      if (pathname === '/api/tools/search-web' || pathname === '/api/web-search') {
        res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
      } else if (pathname === '/api/youtube-search' || pathname === '/api/youtube-info') {
        res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=7200');
      }
    }
  }

  // 3. Streaming SSE Anti-Buffering & Keep-Alive Headers
  const isStreamingPath = pathname.includes('/chat') || pathname.includes('/stream') || pathname.includes('/deep-research');
  if (isStreamingPath) {
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
  }

  const startedAt = Date.now();
  let finished = false;

  // 4. Pre-emptive Defensive Watchdog (Menembak SEBELUM platform Vercel memotong koneksi)
  const watchdog = setTimeout(() => {
    if (finished) return;
    finished = true;
    console.error(`[Vercel Gateway Timeout] ${rawUrl} melampaui batas watchdog ${WATCHDOG_MS}ms (maxDuration terkonfigurasi: ${configuredMaxDuration}s)`);
    sendJson(res, 504, {
      success: false,
      error: `Gateway timeout: Permintaan tidak selesai dalam ${WATCHDOG_MS}ms.`,
      path: rawUrl,
      timeoutMs: WATCHDOG_MS,
      maxDurationSec: configuredMaxDuration,
      hint: 'Buka /api/ping untuk memverifikasi status platform serverless.'
    });
  }, WATCHDOG_MS);

  // 5. Lazy Engine Loading
  let requestHandler = null;
  try {
    const engine = require('../server.js');
    requestHandler = engine && engine.requestHandler;
    if (typeof requestHandler !== 'function') {
      throw new Error(`server.js tidak mengekspor requestHandler (tipe: ${typeof requestHandler})`);
    }
  } catch (err) {
    finished = true;
    clearTimeout(watchdog);
    console.error('[Vercel Gateway] Gagal memuat engine server.js:', err);
    return sendJson(res, 500, {
      success: false,
      error: 'Gagal memuat engine ZOZ Router pada Vercel Gateway',
      details: err && err.message ? err.message : String(err),
      vercel: !!process.env.VERCEL
    });
  }

  // 6. Eksekusi Request Handler Asli
  try {
    await requestHandler(req, res);
  } catch (err) {
    console.error(`[Vercel Gateway Error] ${rawUrl} setelah ${Date.now() - startedAt}ms:`, err);
    sendJson(res, 500, {
      success: false,
      error: 'Internal Server Error on Vercel Gateway',
      details: err && err.message ? err.message : String(err)
    });
  } finally {
    finished = true;
    clearTimeout(watchdog);
  }
};
