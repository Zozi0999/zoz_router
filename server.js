/**
 * ZOZ ROUTER - AI Multi-Engine Neural Gateway & Playground
 * Backend Server with High-Speed Streaming Proxy for Ollama & OpenRouter
 * Zero external dependencies - uses pure Node.js standard library.
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const dns = require('dns');
const net = require('net');
const os = require('os');
const { spawn } = require('child_process');
const textSafety = require('./text-safety');

// Loader node-pty opsional (dengan graceful fallback untuk Vercel / serverless)
let nodePty = null;
try {
  nodePty = require('node-pty');
} catch (_) {
  try {
    const extensionPtyPath = path.join(os.homedir(), 'Desktop', 'terminal-extension', 'host', 'node_modules', 'node-pty');
    if (fs.existsSync(extensionPtyPath)) {
      nodePty = require(extensionPtyPath);
    }
  } catch (_) {
    nodePty = null;
  }
}

// Session store untuk persistent PTY sessions (ConPTY / PseudoConsole)
const activeTerminalSessions = new Map();

// =========================================================================
// CLOUDFLARE TUNNEL REMOTE ACCESS (WAN Mobile-to-Desktop) STATE & ENGINE
// =========================================================================
let cloudflareTunnelProcess = null;
let cloudflareTunnelUrl = '';
let cloudflareTunnelActive = false;
let cloudflareTunnelError = '';
let cloudflareTunnelPin = generateSixDigitPin();
let cloudflareTunnelStartedAt = null;

function generateSixDigitPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getCloudflaredBinaryPath() {
  const localBin = path.join(__dirname, 'bin', 'cloudflared.exe');
  if (fs.existsSync(localBin)) return localBin;
  const localBinNoExt = path.join(__dirname, 'bin', 'cloudflared');
  if (fs.existsSync(localBinNoExt)) return localBinNoExt;
  return 'cloudflared';
}

function startCloudflareTunnel(customPort) {
  return new Promise((resolve) => {
    if (cloudflareTunnelProcess && cloudflareTunnelActive && cloudflareTunnelUrl) {
      return resolve({
        active: true,
        tunnelUrl: cloudflareTunnelUrl,
        wssUrl: cloudflareTunnelUrl.replace(/^http/, 'ws'),
        pin: cloudflareTunnelPin,
        startedAt: cloudflareTunnelStartedAt
      });
    }

    if (cloudflareTunnelProcess) {
      try { cloudflareTunnelProcess.kill(); } catch (_) {}
      cloudflareTunnelProcess = null;
    }

    cloudflareTunnelActive = false;
    cloudflareTunnelUrl = '';
    cloudflareTunnelError = '';

    const binPath = getCloudflaredBinaryPath();
    const targetPort = customPort || process.env.PORT || 4040;
    const args = ['tunnel', '--url', `http://localhost:${targetPort}`, '--no-autoupdate'];

    try {
      cloudflareTunnelProcess = spawn(binPath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (err) {
      cloudflareTunnelError = `Gagal menjalankan cloudflared: ${err.message}.`;
      return resolve({
        active: false,
        tunnelUrl: '',
        wssUrl: '',
        pin: cloudflareTunnelPin,
        error: cloudflareTunnelError
      });
    }

    let resolved = false;
    const timeoutTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (cloudflareTunnelUrl) {
          resolve({
            active: true,
            tunnelUrl: cloudflareTunnelUrl,
            wssUrl: cloudflareTunnelUrl.replace(/^http/, 'ws'),
            pin: cloudflareTunnelPin,
            startedAt: cloudflareTunnelStartedAt
          });
        } else {
          resolve({
            active: false,
            tunnelUrl: '',
            wssUrl: '',
            pin: cloudflareTunnelPin,
            error: cloudflareTunnelError || 'Waktu tunggu pembuatan tunnel Cloudflare habis.'
          });
        }
      }
    }, 25000);

    const onDataChunk = (chunk) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/i);
      if (match && !cloudflareTunnelUrl) {
        cloudflareTunnelUrl = match[0].trim();
        cloudflareTunnelActive = true;
        cloudflareTunnelStartedAt = new Date().toISOString();
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutTimer);
          resolve({
            active: true,
            tunnelUrl: cloudflareTunnelUrl,
            wssUrl: cloudflareTunnelUrl.replace(/^http/, 'ws'),
            pin: cloudflareTunnelPin,
            startedAt: cloudflareTunnelStartedAt
          });
        }
      }
    };

    if (cloudflareTunnelProcess.stdout) {
      cloudflareTunnelProcess.stdout.on('data', onDataChunk);
    }
    if (cloudflareTunnelProcess.stderr) {
      cloudflareTunnelProcess.stderr.on('data', onDataChunk);
    }

    cloudflareTunnelProcess.on('error', (err) => {
      cloudflareTunnelError = err.message;
      cloudflareTunnelActive = false;
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutTimer);
        resolve({ active: false, error: err.message, pin: cloudflareTunnelPin });
      }
    });

    cloudflareTunnelProcess.on('exit', (code) => {
      cloudflareTunnelActive = false;
      cloudflareTunnelProcess = null;
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutTimer);
        resolve({ active: false, error: `Cloudflared keluar dengan kode ${code}`, pin: cloudflareTunnelPin });
      }
    });
  });
}

function stopCloudflareTunnel() {
  if (cloudflareTunnelProcess) {
    try { cloudflareTunnelProcess.kill(); } catch (_) {}
    cloudflareTunnelProcess = null;
  }
  cloudflareTunnelActive = false;
  cloudflareTunnelUrl = '';
  return { active: false, message: 'Cloudflare Tunnel dimatikan.' };
}

function isRemoteTunnelRequest(req) {
  const host = (req.headers.host || '').toLowerCase();
  const cfIp = req.headers['cf-connecting-ip'];
  const cfRay = req.headers['cf-ray'];
  const xfHost = (req.headers['x-forwarded-host'] || '').toLowerCase();
  if (cfIp || cfRay || host.includes('trycloudflare.com') || xfHost.includes('trycloudflare.com')) {
    return true;
  }
  return false;
}

function validateRemoteTerminalPin(req, reqUrl, body) {
  if (!isRemoteTunnelRequest(req)) {
    return { valid: true };
  }
  const clientPin = (reqUrl && reqUrl.searchParams.get('pin')) ||
                    req.headers['x-terminal-pin'] ||
                    (body && body.pin);
  if (!clientPin || String(clientPin).trim() !== String(cloudflareTunnelPin).trim()) {
    return {
      valid: false,
      status: 401,
      error: 'PIN autentikasi remote tidak valid. Masukkan PIN 6-digit dari laptop host.'
    };
  }
  return { valid: true };
}

function resolveHostShell(shellType) {
  const isWin = process.platform === 'win32';
  const type = (shellType || 'powershell').toLowerCase();
  if (type === 'cmd' || type === 'cmd.exe') {
    return { exe: isWin ? 'cmd.exe' : 'sh', args: [] };
  }
  if (type === 'wsl' || type === 'bash' || type === 'ubuntu-wsl') {
    return { exe: isWin ? 'wsl.exe' : 'bash', args: isWin ? ['-e', 'bash'] : [] };
  }
  if (type === 'node') {
    return { exe: process.execPath, args: [] };
  }
  if (type === 'python') {
    return { exe: isWin ? 'python.exe' : 'python3', args: ['-i'] };
  }
  // Default: PowerShell dengan $PROFILE termuat utuh (tanpa -NoProfile)
  return {
    exe: isWin ? 'powershell.exe' : 'pwsh',
    args: ['-ExecutionPolicy', 'Bypass']
  };
}

// Loader .env minimal (TANPA dependensi eksternal — proyek zero-dep).
// Baca file .env bila ada, parse baris KEY=VALUE (lewati komentar/baris kosong),
// dan JANGAN pernah menimpa variabel yang sudah ada di process.env.
try {
  const envFilePath = path.join(__dirname, '.env');
  if (fs.existsSync(envFilePath)) {
    const envLines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);
    for (const envLine of envLines) {
      const trimmedEnvLine = envLine.trim();
      if (!trimmedEnvLine || trimmedEnvLine.startsWith('#')) continue;
      const eqIdx = trimmedEnvLine.indexOf('=');
      if (eqIdx <= 0) continue;
      const envKey = trimmedEnvLine.slice(0, eqIdx).trim();
      let envValue = trimmedEnvLine.slice(eqIdx + 1).trim();
      if (envValue.startsWith('"') || envValue.startsWith("'")) {
        // Berpetik: nilai = isi di antara petik; komentar inline SETELAH petik
        // penutup diabaikan (semantik dotenv): KEY="a b" # catatan → "a b".
        const quoteChar = envValue[0];
        const closeQuoteIdx = envValue.indexOf(quoteChar, 1);
        envValue = closeQuoteIdx > 0 ? envValue.slice(1, closeQuoteIdx) : envValue.slice(1);
      } else {
        // Tanpa petik: komentar inline dimulai dari spasi diikuti '#' —
        // "abc # catatan" → "abc", tapi "abc#def" tetap utuh (tanpa spasi).
        const inlineCommentIdx = envValue.search(/\s#/);
        if (inlineCommentIdx >= 0) envValue = envValue.slice(0, inlineCommentIdx).trimEnd();
      }
      if (envKey && !(envKey in process.env)) process.env[envKey] = envValue;
    }
  }
} catch (envErr) {
  console.warn('Warning: gagal memuat file .env:', envErr.message);
}

const PORT = process.env.PORT || 4040;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.bin': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.weba': 'audio/webm',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg'
};

const IS_VERCEL_ENV = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = IS_VERCEL_ENV ? path.join('/tmp', 'data') : path.join(__dirname, 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Ensure data directories exist on device storage safely
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch (e) {
  console.warn('Warning creating data directories:', e.message);
}

// Helper to send JSON responses
function sendJSON(res, statusCode, data) {
  if (res.headersSent || res.writableEnded || res.destroyed) return;
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint, x-title, HTTP-Referer, x-serper-key, x-ollama-key, x-api-key, x-openrouter-key, x-session-id, X-Session-ID, x-user-id, X-User-ID, x-client-id, X-Client-ID, x-user-token, X-User-Token, Access-Control-Request-Private-Network'
  });
  res.end(JSON.stringify(data));
}

// Helper to parse JSON request body safely with Buffer chunks and Serverless pre-parsed support
function parseBody(req) {
  // Dukungan lingkungan serverless (Vercel / Lambda) di mana body sudah di-parse oleh gateway
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') {
      return Promise.resolve(req.body);
    }
    if (typeof req.body === 'string') {
      try {
        return Promise.resolve(req.body.trim() ? JSON.parse(req.body) : {});
      } catch (_) {
        // F18: JSON rusak jangan pernah dianggap {} (dulu POST /api/sessions dengan
        // body terpotong sukses palsu & membuat sesi sampah).
        return Promise.reject(new Error('Body JSON tidak valid.'));
      }
    }
    if (Buffer.isBuffer(req.body)) {
      try {
        const str = req.body.toString('utf8');
        return Promise.resolve(str.trim() ? JSON.parse(str) : {});
      } catch (_) {
        return Promise.reject(new Error('Body JSON tidak valid.'));
      }
    }
  }

  // Jika stream sudah ended atau tidak ada body, jangan tunggu event yang tidak akan pernah fired
  if (req.readableEnded || req.complete) {
    return Promise.resolve({});
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const safeResolve = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };
    const safeReject = (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    const chunks = [];
    let totalLength = 0;
    req.on('data', chunk => {
      chunks.push(chunk);
      totalLength += chunk.length;
      if (totalLength > 50 * 1024 * 1024) { // 50MB limit
        req.destroy();
        safeReject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (chunks.length === 0 || totalLength === 0) return safeResolve({});
      try {
        const bodyStr = Buffer.concat(chunks, totalLength).toString('utf8');
        if (!bodyStr.trim()) return safeResolve({});
        safeResolve(JSON.parse(bodyStr));
      } catch (e) {
        // F18: reject, jangan senyapkan — penulis JSON rusak kini menerima error
        // (4xx/5xx dari rute) alih-alih sukses 200 dengan data sampah.
        safeReject(new Error('Body JSON tidak valid: ' + (e && e.message ? e.message : e)));
      }
    });
    req.on('close', () => {
      if (!req.complete && !settled) {
        safeReject(new Error('Request aborted by client'));
      }
    });
    req.on('error', err => safeReject(err));
  });
}

// Helper ekstraksi domain aman dengan proteksi try-catch & parsing URL fleksibel
function extractDomainSafe(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    const parsed = new URL(candidate);
    return parsed.hostname.replace(/^www\./i, '');
  } catch (e) {
    const match = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\?#:]+)/i);
    return match ? match[1] : '';
  }
}

// Validasi host privat/lokal untuk proteksi SSRF
function isPrivateHost(hostname, port) {
  if (!hostname || typeof hostname !== 'string') return true;
  let host = hostname.toLowerCase().trim();
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }
  // Literal IP (IPv4/IPv6) → delegasikan ke helper range lengkap supaya
  // 100.64.0.0/10, 192.0.0.0/24, 198.18.0.0/15, multicast/reserved, dsb ikut
  // terblokir (rentang yang dulu hanya dicakup isPrivateOrReservedIPv4/IPv6).
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) return isPrivateOrReservedIPv4(host);
  if (ipVersion === 6) return isPrivateOrReservedIPv6(host);
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0' || host === '::' || host === '0') return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true; // Link-local
  if (/^fc00:|^fe80:/i.test(host)) return true; // IPv6 Unique Local & Link-Local

  // Handle IPv4-mapped IPv6 addresses (::ffff:10.x.x.x, ::ffff:192.168.x.x, etc.)
  if (host.startsWith('::ffff:')) {
    const ipv4Part = host.slice(7);
    if (/^127\./.test(ipv4Part)) return true;
    if (/^10\./.test(ipv4Part)) return true;
    if (/^192\.168\./.test(ipv4Part)) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ipv4Part)) return true;
    if (/^169\.254\./.test(ipv4Part)) return true;
    if (/^0\.0\.0\.0$/.test(ipv4Part)) return true;
    return true; // Block all IPv4-mapped IPv6 as private
  }

  // Block other IPv4-mapped IPv6 hex variants
  if (host.startsWith('::7f00:') || host.startsWith('::a9fe:') || host.startsWith('::c0a8:') || host.startsWith('::0a')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true;
  const numPort = Number(port);
  if (numPort === 11434 || numPort === 4040 || numPort === 8080) {
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  }
  return false;
}

// Validasi endpoint Ollama terhadap SSRF — blokir host privat/internal kecuali Ollama lokal default (127.0.0.1:11434)
function isOllamaEndpointForbidden(endpointUrl) {
  let parsed;
  try { parsed = new URL(endpointUrl); } catch (e) { return true; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return true;
  const host = (parsed.hostname || '').toLowerCase();
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  // Izinkan Ollama lokal default untuk development (bukan vektor SSRF)
  if ((host === '127.0.0.1' || host === 'localhost' || host === '::1') && port === '11434') return false;
  return isPrivateHost(host, port);
}

// ===== M23: PELINDUNG SSRF RESOLUSI DNS (anti DNS-rebinding) =====
// Cek hostname-string saja bisa dibobol: hostname publik yang me-resolve ke IP
// privat/loopback/metadata (rebinding, *.nip.io, DNS penyerang lolos). Fungsi ini
// me-resolve dulu dan MENOLAK bila ada SATU PUN hasil privat. Hasil:
// - URL tak terurai / protokol non-http → lolos (validasi string di bawah menangani)
// - literal IP → lolos (isPrivateHost sudah memeriksa angkanya)
// - DNS gagal (ENOTFOUND dst) → lolos (biarkan koneksi gagal alami dengan pesannya)
// - me-resolve ke IP privat → DITOLAK
// Helper: check if an IPv4 address is in a reserved/special-use range
// that should be treated as "private" for SSRF/DNS-rebinding protection.
// This complements isPrivateHost() which handles RFC1918 + loopback + link-local.
function isPrivateOrReservedIPv4(ip) {
  if (!ip || typeof ip !== 'string') return false;
  // IPv4-mapped IPv6 (::ffff:x.x.x.x) - extract IPv4 part
  let ipv4 = ip.trim();
  if (ipv4.startsWith('::ffff:')) {
    ipv4 = ipv4.slice(7);
  }
  // If hex mapped/compat parts like a9fe:a0fe
  if (ipv4.includes(':')) {
    const parts = ipv4.split(':');
    if (parts.length === 2) {
      const high = parseInt(parts[0], 16);
      const low = parseInt(parts[1], 16);
      if (!isNaN(high) && !isNaN(low)) {
        ipv4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
      }
    }
  }
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ipv4)) return false;
  const parts = ipv4.split('.').map(Number);
  if (parts.some(p => p < 0 || p > 255)) return false;
  const [a, b, c, d] = parts;

  // 0.0.0.0/8 - "this network" (RFC 1122)
  if (a === 0) return true;
  // 10.0.0.0/8 - private (RFC 1918)
  if (a === 10) return true;
  // 100.64.0.0/10 - CGNAT (RFC 6598)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 - loopback (RFC 1122)
  if (a === 127) return true;
  // 169.254.0.0/16 - link-local (RFC 3927)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 - private (RFC 1918)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 - IETF protocol assignments (RFC 6890)
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24 - TEST-NET-1 (RFC 5737)
  if (a === 192 && b === 0 && c === 2) return true;
  // 192.88.99.0/24 - 6to4 relay anycast (RFC 3068, deprecated but still in use)
  if (a === 192 && b === 88 && c === 99) return true;
  // 192.168.0.0/16 - private (RFC 1918)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 - benchmarking (RFC 2544)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 - TEST-NET-2 (RFC 5737)
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 - TEST-NET-3 (RFC 5737)
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 - multicast (RFC 1112)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 - reserved for future use (RFC 1112)
  if (a >= 240) return true;
  // 255.255.255.255/32 - limited broadcast (RFC 919)
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;
  return false;
}

// Helper: check if an IPv6 address is in a reserved/special-use range
function isPrivateOrReservedIPv6(ip) {
  if (!ip || typeof ip !== 'string') return false;
  let lower = ip.toLowerCase().trim();
  if (lower.startsWith('[') && lower.endsWith(']')) lower = lower.slice(1, -1);
  const zoneIdx = lower.indexOf('%');
  if (zoneIdx !== -1) lower = lower.slice(0, zoneIdx);

  // ::1/128 - loopback
  if (lower === '::1') return true;
  // ::/128 - unspecified
  if (lower === '::') return true;
  // ::ffff:0:0/96 - IPv4-mapped (handled by extracting IPv4 and checking isPrivateOrReservedIPv4)
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice(7);
    if (mapped.includes('.')) return isPrivateOrReservedIPv4(mapped);
    if (mapped.includes(':')) {
      const parts = mapped.split(':');
      if (parts.length === 2) {
        const high = parseInt(parts[0], 16);
        const low = parseInt(parts[1], 16);
        if (!isNaN(high) && !isNaN(low)) {
          const dotted = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
          return isPrivateOrReservedIPv4(dotted);
        }
      }
    }
    return true; // Malformed/reserved mapped IPv6 -> reject defensively
  }
  // ::/96 - IPv4-compatible (deprecated)
  if (lower.startsWith('::') && lower !== '::1' && lower !== '::') {
    const compat = lower.slice(2);
    if (compat.includes('.')) return isPrivateOrReservedIPv4(compat);
    const parts = compat.split(':');
    if (parts.length === 2) {
      const high = parseInt(parts[0], 16);
      const low = parseInt(parts[1], 16);
      if (!isNaN(high) && !isNaN(low)) {
        const dotted = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        return isPrivateOrReservedIPv4(dotted);
      }
    }
  }
  // fc00::/7 - unique local addresses (RFC 4193)
  if (/^f[cd][0-9a-f]{0,2}:/i.test(lower)) return true;
  // fe80::/10 - link-local (RFC 4291)
  if (/^fe[89ab][0-9a-f]{0,2}:/i.test(lower)) return true;
  // 2001:db8::/32 - documentation (RFC 3849)
  if (lower.startsWith('2001:db8:') || lower.startsWith('2001:0db8:')) return true;
  // ff00::/8 - multicast (RFC 4291)
  if (lower.startsWith('ff')) return true;
  // 2001:10::/28 - ORCHID (RFC 4843, deprecated)
  if (lower.startsWith('2001:10:') || lower.startsWith('2001:0010:')) return true;
  // 2001:20::/28 - ORCHIDv2 (RFC 7343)
  if (lower.startsWith('2001:20:') || lower.startsWith('2001:0020:')) return true;
  return false;
}

// ===== M23: PELINDUNG SSRF RESOLUSI DNS (anti DNS-rebinding) =====
// Cek hostname-string saja bisa dibobol: hostname publik yang me-resolve ke IP
// privat/loopback/metadata (rebinding, *.nip.io, DNS penyerang lolos). Fungsi ini
// me-resolve dulu pakai dns.resolve4/resolve6 (bypass /etc/hosts) dan MENOLAK
// bila ada SATU PUN hasil privat/reserved. Hasil:
// - URL tak terurai / protokol non-http → lolos (validasi string di bawah menangani)
// - literal IP → lolos (isPrivateHost sudah memeriksa angkanya)
// - DNS gagal (ENOTFOUND dst) → lolos (biarkan koneksi gagal alami dengan pesannya)
// - me-resolve ke IP privat/reserved → DITOLAK
// Returns { ok: boolean, msg?: string, ips?: string[] } where ips are pinned IPv4/IPv6 addresses
async function assertResolvesPublic(rawUrl) {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') return { ok: true };
    const asUrl = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rawUrl.trim()) ? rawUrl.trim() : 'http://' + rawUrl.trim();
    const u = new URL(asUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: true };
    const host = u.hostname.replace(/^\[/, '').replace(/\]$/, '');
    if (!host || net.isIP(host)) return { ok: true };

    // Use dns.resolve4 and dns.resolve6 instead of lookup to bypass /etc/hosts
    // and get authoritative DNS results. Run both in parallel.
    const [ipv4Addrs, ipv6Addrs] = await Promise.all([
      dns.promises.resolve4(host).catch(() => []),
      dns.promises.resolve6(host).catch(() => [])
    ]);

    const allIps = [...(Array.isArray(ipv4Addrs) ? ipv4Addrs : []), ...(Array.isArray(ipv6Addrs) ? ipv6Addrs : [])];
    if (allIps.length === 0) return { ok: true };

    for (const ip of allIps) {
      const ipStr = String(ip).trim();
      if (!ipStr) continue;
      // Check both IPv4 and IPv6 private/reserved ranges
      if (isPrivateOrReservedIPv4(ipStr) || isPrivateOrReservedIPv6(ipStr) || isPrivateHost(ipStr, undefined)) {
        return { ok: false, msg: `Akses diblokir (SSRF/DNS-rebinding): hostname me-resolve ke IP privat/reserved ${ipStr}.` };
      }
    }
    // Return pinned IPs for callers that want to enforce IP pinning on subsequent connections
    return { ok: true, ips: allIps };
  } catch (_) {
    // DNS resolution failed (ENOTFOUND, etc.) - allow connection to proceed naturally
    return { ok: true };
  }
}

// Endpoint Ollama yang BOLEH menerima secret milik server (OLLAMA_API_KEY dari
// environment). Endpoint khusus yang dikirim klien bisa menunjuk ke server
// penyerang — env key tidak pernah diteruskan ke sana (pencegahan ekstraksi
// secret lewat endpoint SSRF yang dikontrol klien).
function isTrustedOllamaEndpoint(endpointUrl) {
  let parsed;
  try { parsed = new URL(endpointUrl); } catch (e) { return false; }
  const host = (parsed.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'ollama.com' || host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

// Sanitasi userId untuk mencegah path traversal dan memastikan isolasi pengguna
function sanitizeUserId(userId) {
  if (!userId || typeof userId !== 'string') return 'default';
  const clean = userId.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(clean) || clean.length > 64) {
    return 'default';
  }
  return clean;
}

// ==================== IDENTITAS KLIEN (capability token) ====================
// Dulu identitas hanya mengandalkan header X-User-ID yang bisa dipalsukan siapa
// saja → setiap user bisa membaca/menghapus sesi user lain. Kini setiap userId
// harus "mendaftar" pada kunjungan pertama dengan X-User-Token (secret acak
// 256-bit yang hanya hidup di localStorage klien). Server menyimpan SHA-256 dari
// token, bukan token mentah. Request dari userId terdaftar tanpa token yang
// cocok DITOLAK (401). Identitas 'default'/tanpa header tetap anonim untuk
// kompatibilitas klien lawas & perkakas baris perintah.
const IDENTITY_FILE = path.join(DATA_DIR, 'identities.json');
let identityRegistry = null;

function loadIdentityRegistry() {
  if (identityRegistry) return identityRegistry;
  try {
    let parsed = {};
    if (fs.existsSync(IDENTITY_FILE)) {
      parsed = JSON.parse(fs.readFileSync(IDENTITY_FILE, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {};
    }
    // Object.create(null) dengan filter eksplisit: mencegah __proto__/constructor/prototype
    // dari prototype-pollution saat lookup/penulisan.
    identityRegistry = Object.create(null);
    if (parsed && typeof parsed === 'object') {
      for (const [key, val] of Object.entries(parsed)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        identityRegistry[key] = val;
      }
    }
  } catch (_) {
    identityRegistry = Object.create(null);
  }
  return identityRegistry;
}

function hashUserToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

function safeAtomicRenameSync(src, dst) {
  try {
    fs.renameSync(src, dst);
  } catch (err) {
    if (err && (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EXDEV' || err.code === 'EACCES')) {
      fs.copyFileSync(src, dst);
      try { fs.unlinkSync(src); } catch (_) {}
    } else {
      throw err;
    }
  }
}

function persistIdentityRegistry() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = IDENTITY_FILE + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(identityRegistry || {}, null, 2), 'utf8');
    safeAtomicRenameSync(tmp, IDENTITY_FILE);
  } catch (_) {}
}

// Resolusi identitas SEKALI per request. Mengembalikan { userId } bila sah, atau
// { error, status } bila request harus ditolak. Sumber identitas HANYA header
// (atau query untuk endpoint GET khusus) — body.userId tidak pernah dipercaya.
function resolveRequestIdentity(req, reqUrl) {
  const rawUid = req.headers['x-user-id'] || req.headers['x-client-id'] ||
    (reqUrl ? reqUrl.searchParams.get('userId') : null);
  const token = req.headers['x-user-token'] ||
    (reqUrl ? reqUrl.searchParams.get('userToken') : null);

  // Tanpa identitas = klien lawas → bucket bersama 'default' (perilaku lama).
  if (!rawUid || rawUid === 'default') {
    return { userId: 'default', anonymous: true };
  }

  const uid = String(rawUid).trim();
  const clean = sanitizeUserId(uid);
  if (clean !== uid) {
    return { status: 400, error: 'Format X-User-ID tidak valid. Gunakan hanya alphanumeric, underscore, dan dash (maks 64 karakter).' };
  }

  const registry = loadIdentityRegistry();
  const hash = token ? hashUserToken(token) : null;
  const known = Object.prototype.hasOwnProperty.call(registry, clean);

  if (known) {
    // Terdaftar: WAJIB membawa token yang cocok (menangkal pembajakan identitas).
    if (!hash || hash !== registry[clean]) {
      return { status: 401, error: 'X-User-Token tidak cocok untuk identitas ini. Identitas user tidak dapat dipalsukan.' };
    }
  } else {
    // Pendaftaran kunjungan pertama: token wajib agar uid tak dikenal tidak
    // bisa diklaim oleh pihak lain.
    if (!hash) {
      return { status: 401, error: 'X-User-Token dibutuhkan untuk mendaftarkan identitas baru. Perbarui klien Zoz Router (refresh halaman).' };
    }
    registry[clean] = hash;
    persistIdentityRegistry();
  }
  return { userId: clean };
}

// Dapatkan direktori penyimpanan sesi khusus per user
// Cache direktori yang SUDAH dipastikan ada agar existsSync+mkdirSync tidak
// berjalan di setiap request (jalur panas: list/detail sesi per permintaan).
const ensuredUserSessionDirs = new Set();
function getUserSessionsDir(userId) {
  const cleanUid = sanitizeUserId(userId);
  const userDir = path.join(SESSIONS_DIR, cleanUid);
  if (ensuredUserSessionDirs.has(cleanUid)) return userDir; // cache hit → langsung
  if (!fs.existsSync(userDir)) {
    try {
      fs.mkdirSync(userDir, { recursive: true });
      ensuredUserSessionDirs.add(cleanUid);
    } catch (_) {
      // Gagal dibuat → JANGAN di-cache agar percobaan berikutnya mengulang
    }
  } else {
    ensuredUserSessionDirs.add(cleanUid);
  }
  return userDir;
}

// Migrasi file sesi lama di root SESSIONS_DIR ke folder 'default'
function migrateLegacySessionsIfAny() {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) return;
    const entries = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true });
    const legacyFiles = entries.filter(e => e.isFile() && e.name.endsWith('.json'));
    if (legacyFiles.length > 0) {
      const defaultUserDir = path.join(SESSIONS_DIR, 'default');
      if (!fs.existsSync(defaultUserDir)) {
        fs.mkdirSync(defaultUserDir, { recursive: true });
      }
      for (const f of legacyFiles) {
        const oldPath = path.join(SESSIONS_DIR, f.name);
        const newPath = path.join(defaultUserDir, f.name);
        try {
          if (!fs.existsSync(newPath)) {
            fs.renameSync(oldPath, newPath);
          } else {
            fs.unlinkSync(oldPath);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
}
try { migrateLegacySessionsIfAny(); } catch (_) {}

// Validasi sessionId untuk mencegah path traversal dan memastikan isolasi per user
function validateSessionId(sessionId, userId = 'default') {
  if (!sessionId || typeof sessionId !== 'string') return { valid: false, error: 'ID sesi diperlukan.' };
  const id = sessionId.trim();
  if (id.length > 128) return { valid: false, error: 'ID sesi terlalu panjang (maks 128 karakter).' };
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return { valid: false, error: 'Format ID sesi tidak valid. Hanya alphanumeric, garis bawah, dan tanda hubung yang diperbolehkan.' };
  
  const cleanUid = sanitizeUserId(userId);
  const userDir = getUserSessionsDir(cleanUid);
  const sessFile = path.join(userDir, `${id}.json`);
  const resolved = path.resolve(sessFile);
  const resolvedUserDir = path.resolve(userDir);
  if (!resolved.startsWith(resolvedUserDir + path.sep) && resolved !== resolvedUserDir) {
    return { valid: false, error: 'Forbidden: Path traversal terdeteksi.' };
  }
  return { valid: true, id, sessFile, userDir, userId: cleanUid };
}

// Helper untuk mengunduh buffer gambar dari URL eksternal dengan proteksi SSRF, batas redirect loop, dan memory buffer cap
function downloadImageBuffer(imageUrl, timeoutMs = 35000, redirectCount = 0) {
  // M23: guard DNS anti-rebinding sebelum koneksi — berjalan di TIAP hop karena
  // fungsi ini rekursif saat redirect (redirect bisa mengarah ke host internal).
  return assertResolvesPublic(imageUrl).then((verdict) => {
    if (!verdict.ok) return Promise.reject(new Error(verdict.msg));
    return new Promise((resolve, reject) => {
    let settled = false;
    const safeResolve = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };
    const safeReject = (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    try {
      if (redirectCount > 3) {
        return safeReject(new Error('Terlalu banyak redirect saat mengunduh gambar (maksimal 3 redirect)'));
      }
      if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
        return safeReject(new Error('URL gambar kosong atau tidak valid'));
      }
      const parsed = new URL(imageUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return safeReject(new Error(`Protokol tidak didukung: ${parsed.protocol}`));
      }
      if (isPrivateHost(parsed.hostname, parsed.port)) {
        return safeReject(new Error(`Akses ke host lokal/privat diblokir untuk keamanan (SSRF Protection): ${parsed.hostname}`));
      }

      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(parsed.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        },
        timeout: timeoutMs
      }, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          try {
            res.resume();
            const redirectUrl = new URL(res.headers.location, imageUrl).toString();
            return downloadImageBuffer(redirectUrl, timeoutMs, redirectCount + 1).then(safeResolve).catch(safeReject);
          } catch (e) {
            return safeReject(new Error('Redirect URL gambar tidak valid'));
          }
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          return safeReject(new Error(`Gagal mengunduh gambar: HTTP ${res.statusCode}`));
        }

        const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // Maksimal 25MB untuk mencegah Memory Exhaustion (OOM)
        let downloadedBytes = 0;
        const chunks = [];

        res.on('data', chunk => {
          downloadedBytes += chunk.length;
          if (downloadedBytes > MAX_IMAGE_BYTES) {
            req.destroy();
            return safeReject(new Error('Ukuran gambar melebihi batas maksimum keamanan 25MB'));
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const contentType = res.headers['content-type'] || 'image/jpeg';
          safeResolve({ buffer, contentType });
        });

        res.on('error', err => safeReject(err));
      });

      req.on('timeout', () => { req.destroy(); safeReject(new Error('Waktu pengunduhan gambar habis (timeout)')); });
      req.on('error', err => safeReject(err));
    } catch (e) {
      safeReject(e);
    }
    });
  });
}

// Official Ollama Cloud Flagship & Popular Standard Models (Included Free Usage & Usage Credits)
const OFFICIAL_OLLAMA_CLOUD_MODELS = [
  { name: 'qwen2.5:1.5b', model: 'qwen2.5:1.5b', tag: 'Fast • Lightweight', isFree: true, cat: 'fast', details: { family: 'qwen2.5' } },
  { name: 'qwen2.5:7b', model: 'qwen2.5:7b', tag: 'General Intelligence', isFree: true, cat: 'flagship', details: { family: 'qwen2.5' } },
  { name: 'qwen2.5-coder:7b', model: 'qwen2.5-coder:7b', tag: 'Coding Expert', isFree: true, cat: 'coding', details: { family: 'qwen2.5' } },
  { name: 'llama3.2:latest', model: 'llama3.2:latest', tag: 'Llama 3.2 3B', isFree: true, cat: 'fast', details: { family: 'llama' } },
  { name: 'llama3.1:8b', model: 'llama3.1:8b', tag: 'Meta Llama 3.1', isFree: true, cat: 'flagship', details: { family: 'llama' } },
  { name: 'deepseek-r1:latest', model: 'deepseek-r1:latest', tag: 'Reasoning Engine', isFree: true, cat: 'reasoning', details: { family: 'deepseek' } },
  { name: 'mistral:latest', model: 'mistral:latest', tag: 'Mistral 7B', isFree: true, cat: 'fast', details: { family: 'mistral' } },
  { name: 'phi4:latest', model: 'phi4:latest', tag: 'Microsoft Phi-4', isFree: true, cat: 'flagship', details: { family: 'phi' } },
  { name: 'gemma2:9b', model: 'gemma2:9b', tag: 'Google Gemma 2', isFree: true, cat: 'flagship', details: { family: 'gemma' } },
  { name: 'gemma4:31b', model: 'gemma4:31b', tag: 'Free Flagship Cloud', isFree: true, cat: 'flagship', details: { family: 'gemma4' } },
  { name: 'gpt-oss:120b', model: 'gpt-oss:120b', tag: 'Free Flagship Cloud', isFree: true, cat: 'flagship', details: { family: 'gpt-oss' } },
  { name: 'gpt-oss:20b', model: 'gpt-oss:20b', tag: 'Free Fast Cloud', isFree: true, cat: 'fast', details: { family: 'gpt-oss' } },
  { name: 'nemotron-3-super', model: 'nemotron-3-super', tag: 'Free Flagship Cloud', isFree: true, cat: 'flagship', details: { family: 'nemotron' } },
  { name: 'nemotron-3-ultra', model: 'nemotron-3-ultra', tag: 'Free Flagship Cloud', isFree: true, cat: 'flagship', details: { family: 'nemotron' } },
  { name: 'nemotron-3-nano:30b', model: 'nemotron-3-nano:30b', tag: 'Free Fast Cloud', isFree: true, cat: 'fast', details: { family: 'nemotron' } },
  { name: 'deepseek-v4.1-flash', model: 'deepseek-v4.1-flash', tag: 'Fast Cloud', isFree: false, cat: 'fast', details: { family: 'deepseek' } },
  { name: 'deepseek-v4-pro:0813', model: 'deepseek-v4-pro:0813', tag: 'Reasoning Cloud', isFree: false, cat: 'reasoning', details: { family: 'deepseek' } },
  { name: 'mistral-large-3:675b', model: 'mistral-large-3:675b', tag: 'Flagship Cloud', isFree: false, cat: 'flagship', details: { family: 'mistral' } },
  { name: 'kimi-k3', model: 'kimi-k3', tag: 'Long Context Cloud', isFree: false, cat: 'flagship', details: { family: 'kimi' } },
  { name: 'kimi-k2.6', model: 'kimi-k2.6', tag: 'Flagship Cloud', isFree: false, cat: 'flagship', details: { family: 'kimi' } },
  { name: 'kimi-k2.7-code', model: 'kimi-k2.7-code', tag: 'Coding Cloud', isFree: false, cat: 'coding', details: { family: 'kimi' } },
  { name: 'minimax-m3', model: 'minimax-m3', tag: 'Flagship Cloud', isFree: false, cat: 'flagship', details: { family: 'minimax' } },
  { name: 'minimax-m2.7', model: 'minimax-m2.7', tag: 'Cloud', isFree: false, cat: 'flagship', details: { family: 'minimax' } },
  { name: 'glm-5.3', model: 'glm-5.3', tag: 'Flagship Cloud', isFree: false, cat: 'flagship', details: { family: 'glm' } },
  { name: 'glm-5.3-flash', model: 'glm-5.3-flash', tag: 'Fast Cloud', isFree: false, cat: 'fast', details: { family: 'glm' } },
  { name: 'glm-5.2', model: 'glm-5.2', tag: 'Cloud', isFree: false, cat: 'flagship', details: { family: 'glm' } }
];

function mapOllamaModelToOpenRouter(modelId) {
  if (!modelId || typeof modelId !== 'string') return 'openrouter/free';
  const id = modelId.toLowerCase().trim();
  if (id.includes('/')) return modelId;

  if (id.includes('gemma')) {
    return 'nvidia/nemotron-3.5-lightning:free';
  }
  if (id.includes('nemotron-3-super') || id.includes('gpt-oss:120b') || id.includes('nemotron-3-ultra')) {
    return 'nvidia/nemotron-3-super-120b-a12b:free';
  }
  if (id.includes('nemotron-3-nano') || id.includes('reasoning') || id.includes('deepseek-r1') || id.includes('deepseek-v4-pro')) {
    return 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
  }
  if (id.includes('nemotron-3.5') || id.includes('nemotron')) {
    return 'nvidia/nemotron-3.5-lightning:free';
  }
  if (id.includes('gpt-oss')) {
    return 'nvidia/nemotron-3-super-120b-a12b:free';
  }
  if (id.includes('qwen2.5-coder') || id.includes('coder') || id.includes('code') || id.includes('kimi-k2.7-code')) {
    return 'cohere/north-mini-code:free';
  }
  if (id.includes('dots')) return 'dots-studio/dots-3-note-preview:free';
  if (id.includes('liquid') || id.includes('lfm')) return 'liquid/lfm-2.5-2.6b:free';
  if (id.includes('deepseek')) return 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
  if (id.includes('llama')) return 'nvidia/nemotron-3.5-lightning:free';
  if (id.includes('qwen')) return 'nvidia/nemotron-3.5-lightning:free';
  if (id.includes('mistral')) return 'nvidia/nemotron-3.5-lightning:free';
  if (id.includes('phi')) return 'openrouter/free';

  return 'nvidia/nemotron-3.5-lightning:free';
}

// ==================== GLOBAL SEARCH & ENGLISH QUERY ADAPTER ====================
// Memastikan kueri pencarian otonom menjangkau indeks internasional/global
// dan mengonversi topik pengguna berbahasa Indonesia menjadi kata kunci pencarian bahasa Inggris global.
const INDO_DOMESTIC_PATTERN = /\b(indonesia|indonesian|jakarta|jabar|jatim|jateng|bandung|surabaya|medan|semarang|yogyakarta|jogja|bali|denpasar|aceh|sumatera|papua|kalimantan|sulawesi|nusantara|ikn\b|rupiah|idr\b|bmkg|pilkada|pemilu|kpu\b|bawaslu|prabowo|gibran|jokowi|bansos|bpjs|kominfo|menkominfo|kemendagri|kemenkes|kemendikbud|bumn|kemenkeu|sri mulyani|tni\b|polri|polda|polres|kapolri|dpr\b|mpr\b|dpd\b|kpk\b|kejagung|bca\b|mandiri\b|bri\b|bni\b|pertamina|pln\b)\b/i;

function isExplicitDomesticIndoQuery(str) {
  if (!str || typeof str !== 'string') return false;
  return INDO_DOMESTIC_PATTERN.test(str);
}

const INDO_WORDS_PATTERN = /\b(apa|apakah|siapa|siapakah|bagaimana|bagaimanakah|gimana|gimanakah|mengapa|kenapa|kapan|dimana|ke mana|di mana|dari mana|mana|yang|dan|atau|tetapi|namun|dengan|untuk|bagi|pada|di|ke|dari|tentang|mengenai|soal|terkait|adalah|ialah|yaitu|yakni|merupakan|bisa|dapat|terbaru|terkini|berita|warta|kabar|hari ini|minggu ini|bulan ini|tahun ini|sekarang|saat ini|kemarin|besok|perkembangan|kemajuan|penelitian|riset|penemuan|fitur|pembaruan|rilis|peluncuran|ulasan|panduan|cara|tips|trik|harga|biaya|pasar|saham|uang|bursa|ekonomi|keuangan|teknologi|sains|ilmiah|kesehatan|medis|kedokteran|penyakit|obat|perang|senjata|militer|dunia|internasional|luar angkasa|mobil|listrik|cuaca|gempa|keamanan|jaringan|kinerja|kecepatan|terbaik|tercepat|terbesar|faktor|penyebab|dampak|alasan|penjelasan|analisis|tolong|carikan|cari|bantu|coba|berapa|seperti|kayak|fungsi|arti|maksud|contoh)\b/i;

function hasIndonesianWords(str) {
  if (!str || typeof str !== 'string') return false;
  return INDO_WORDS_PATTERN.test(str);
}

const REPUTABLE_TECH_DOMAINS = new Set([
  'reuters.com', 'bloomberg.com', 'axios.com', 'apnews.com', 'wsj.com',
  'techcrunch.com', 'theverge.com', 'wired.com', 'arstechnica.com', 'venturebeat.com',
  'engadget.com', 'zdnet.com', 'tomshardware.com', 'anandtech.com',
  'openai.com', 'anthropic.com', 'deepmind.google', 'ai.meta.com', 'blog.google',
  'microsoft.com', 'nvidia.com', 'huggingface.co', 'github.com',
  'arxiv.org', 'nature.com', 'science.org', 'technologyreview.com',
  'mit.edu', 'stanford.edu', 'bbc.com', 'cnbc.com', 'ft.com'
]);

const GLOBAL_SEARCH_PHRASE_DICT = [
  [/\bbotol minuman termostatik(?:nya)?\b/gi, 'thermos vacuum flask thermostatic bottle'],
  [/\bbotol termostatik(?:nya)?\b/gi, 'thermos vacuum flask bottle'],
  [/\bbotol minum(?:an)?(?:nya)?\b/gi, 'water bottle flask'],
  [/\bgempa bumi(?:nya)?\b/gi, 'earthquake'],
  [/\bangin topan(?:nya)?\b/gi, 'typhoon hurricane'],
  [/\bgunung berapi(?:nya)?\b/gi, 'volcano eruption'],
  [/\btanah longsor(?:nya)?\b/gi, 'landslide'],
  [/\bpanel surya(?:nya)?\b/gi, 'solar panels'],
  [/\bbaterai litium(?:nya)?\b/gi, 'lithium battery'],
  [/\bkartu grafis(?:nya)?\b/gi, 'graphics card gpu'],
  [/\bprosesor komputer(?:nya)?\b/gi, 'cpu processor'],
  [/\blubang hitam(?:nya)?\b/gi, 'black hole'],
  [/\bteori relativitas(?:nya)?\b/gi, 'theory of relativity'],
  [/\btata surya(?:nya)?\b/gi, 'solar system'],
  [/\brekayasa genetika(?:nya)?\b/gi, 'genetic engineering'],
  [/\bpembangkit listrik(?:nya)?\b/gi, 'power plant generator'],
  [/\bberita besar(?:nya)?\b/gi, 'major news headlines'],
  [/\bmodel(?:-model)? ai\b/gi, 'ai models'],
  [/\bmodel(?:-model)? llm\b/gi, 'llm models'],
  [/\bmodel penalaran(?:nya)?\b/gi, 'reasoning models'],
  [/\bmodel multimodal(?:nya)?\b/gi, 'multimodal models'],
  [/\bmodel terbuka(?:nya)?\b/gi, 'open source ai models'],
  [/\bperkembangan ai(?:nya)?\b/gi, 'ai developments'],
  [/\bterobosan ai(?:nya)?\b/gi, 'ai breakthroughs'],
  [/\bagen ai(?:nya)?\b/gi, 'ai agents'],
  [/\braksasa teknologi\b/gi, 'big tech companies'],
  [/\bperusahaan teknologi\b/gi, 'tech companies'],
  [/\bkecerdasan buatan generatif\b/gi, 'generative ai'],
  [/\bkecerdasan umum buatan(?:nya)?\b/gi, 'artificial general intelligence'],
  [/\bkecerdasan buatan(?:nya)?\b/gi, 'artificial intelligence'],
  [/\bpembelajaran mesin(?:nya)?\b/gi, 'machine learning'],
  [/\bjaringan saraf(?:nya)?\b/gi, 'neural networks'],
  [/\bpemrosesan bahasa alami(?:nya)?\b/gi, 'natural language processing'],
  [/\bmodel bahasa besar(?:nya)?\b/gi, 'large language models'],
  [/\bmodel bahasa(?:nya)?\b/gi, 'language models'],
  [/\brekayasa prompt(?:nya)?\b/gi, 'prompt engineering'],
  [/\bbursa saham(?:nya)?\b/gi, 'stock market'],
  [/\bpasar saham(?:nya)?\b/gi, 'stock market'],
  [/\bpasar modal(?:nya)?\b/gi, 'capital market'],
  [/\bnilai tukar mata uang(?:nya)?\b/gi, 'currency exchange rate'],
  [/\bnilai tukar(?:nya)?\b/gi, 'exchange rate'],
  [/\bmata uang(?:nya)?\b/gi, 'currency'],
  [/\bsuku bunga(?:nya)?\b/gi, 'interest rates'],
  [/\bminyak bumi(?:nya)?\b/gi, 'crude oil'],
  [/\bmobil listrik(?:nya)?\b/gi, 'electric vehicles'],
  [/\bluar angkasa(?:nya)?\b/gi, 'space exploration'],
  [/\btimur tengah(?:nya)?\b/gi, 'middle east'],
  [/\bperang dunia(?:nya)?\b/gi, 'world war'],
  [/\bperubahan iklim(?:nya)?\b/gi, 'climate change'],
  [/\bpemanasan global(?:nya)?\b/gi, 'global warming'],
  [/\benergi terbarukan(?:nya)?\b/gi, 'renewable energy'],
  [/\btenaga nuklir(?:nya)?\b/gi, 'nuclear energy'],
  [/\bdunia nyata(?:nya)?\b/gi, 'real world'],
  [/\bgaya hidup(?:nya)?\b/gi, 'lifestyle'],
  [/\bfitur baru(?:nya)?\b/gi, 'new features'],
  [/\bberita terbaru(?:nya)?\b/gi, 'latest news'],
  [/\bberita terkini(?:nya)?\b/gi, 'breaking news'],
  [/\bberita dunia(?:nya)?\b/gi, 'world news'],
  [/\bkabar terbaru(?:nya)?\b/gi, 'latest updates'],
  [/\bhari ini\b/gi, 'today'],
  [/\bminggu ini\b/gi, 'this week'],
  [/\bbulan ini\b/gi, 'this month'],
  [/\btahun ini\b/gi, 'this year'],
  [/\bsaat ini\b/gi, 'current'],
  [/\bcara kerja(?:nya)?\b/gi, 'how it works'],
  [/\bcara menggunakan(?:nya)?\b/gi, 'how to use'],
  [/\brekayasa perangkat lunak(?:nya)?\b/gi, 'software engineering'],
  [/\bsistem operasi(?:nya)?\b/gi, 'operating system'],
  [/\bkomputasi awan(?:nya)?\b/gi, 'cloud computing'],
  [/\bkomputasi kuantum(?:nya)?\b/gi, 'quantum computing'],
  [/\bkeamanan siber(?:nya)?\b/gi, 'cybersecurity'],
  [/\buji coba(?:nya)?\b/gi, 'trial test'],
  [/\bdampak negatif(?:nya)?\b/gi, 'negative impacts'],
  [/\bdampak positif(?:nya)?\b/gi, 'positive impacts'],
  [/\bkurs dollar(?:nya)?\b/gi, 'usd exchange rate'],
  [/\bkurs euro(?:nya)?\b/gi, 'eur exchange rate'],
  [/\bliga champions\b/gi, 'champions league'],
  [/\bliga inggris\b/gi, 'premier league'],
  [/\bsepak bola\b/gi, 'football soccer']
];

const GLOBAL_SEARCH_WORD_DICT = [
  [/\btermostatik(?:nya)?\b/gi, 'thermostatic vacuum flask'],
  [/\btermos(?:nya)?\b/gi, 'thermos flask'],
  [/\bbotol(?:nya)?\b/gi, 'bottle'],
  [/\bminuman(?:nya)?\b/gi, 'beverage'],
  [/\bpemula(?:nya)?\b/gi, 'beginners'],
  [/\bbumi\b/gi, 'earth'],
  [/\bterbaru(?:nya)?\b/gi, 'latest'],
  [/\bterkini(?:nya)?\b/gi, 'latest'],
  [/\bmutakhir(?:nya)?\b/gi, 'state of the art'],
  [/\bbesar(?:nya)?\b/gi, 'major'],
  [/\bmodel(?:nya)?\b/gi, 'model'],
  [/\btercanggih(?:nya)?\b/gi, 'most advanced'],
  [/\bcanggih(?:nya)?\b/gi, 'advanced'],
  [/\bterobosan(?:nya)?\b/gi, 'breakthrough'],
  [/\bbocoran(?:nya)?\b/gi, 'leak rumor'],
  [/\bsaingan(?:nya)?\b/gi, 'competitor alternative'],
  [/\bpopuler(?:nya)?\b/gi, 'popular trending'],
  [/\btren(?:nya)?\b/gi, 'trends'],
  [/\blaboratorium(?:nya)?\b/gi, 'lab research'],
  [/\bkemampuan(?:nya)?\b/gi, 'capabilities performance'],
  [/\bberita(?:nya)?\b/gi, 'news'],
  [/\bwarta(?:nya)?\b/gi, 'news'],
  [/\bkabar(?:nya)?\b/gi, 'news'],
  [/\bperkembangan(?:nya)?\b/gi, 'developments'],
  [/\bkemajuan(?:nya)?\b/gi, 'advancements'],
  [/\bpenelitian(?:nya)?\b/gi, 'research'],
  [/\briset(?:nya)?\b/gi, 'research'],
  [/\bpenemuan(?:nya)?\b/gi, 'discoveries'],
  [/\bpeluncuran(?:nya)?\b/gi, 'launch'],
  [/\brilis(?:nya)?\b/gi, 'release'],
  [/\bpembaruan(?:nya)?\b/gi, 'update'],
  [/\bfitur(?:nya)?\b/gi, 'features'],
  [/\bspesifikasi(?:nya)?\b/gi, 'specifications'],
  [/\bkelebihan(?:nya)?\b/gi, 'advantages'],
  [/\bkekurangan(?:nya)?\b/gi, 'limitations'],
  [/\bperbandingan(?:nya)?\b/gi, 'comparison'],
  [/\bulasan(?:nya)?\b/gi, 'review'],
  [/\bpanduan(?:nya)?\b/gi, 'guide'],
  [/\btutorial(?:nya)?\b/gi, 'tutorial'],
  [/\bbelajar(?:nya)?\b/gi, 'learn'],
  [/\bcara(?:nya)?\b/gi, 'how to'],
  [/\bharga(?:nya)?\b/gi, 'price'],
  [/\bbiaya(?:nya)?\b/gi, 'cost'],
  [/\btarif(?:nya)?\b/gi, 'rates'],
  [/\bsaham(?:nya)?\b/gi, 'stocks'],
  [/\bkeuangan(?:nya)?\b/gi, 'finance'],
  [/\bekonomi(?:nya)?\b/gi, 'economy'],
  [/\bkripto(?:nya)?\b/gi, 'crypto'],
  [/\bkoin(?:nya)?\b/gi, 'coins'],
  [/\bemas(?:nya)?\b/gi, 'gold price'],
  [/\bperak(?:nya)?\b/gi, 'silver price'],
  [/\bminyak(?:nya)?\b/gi, 'oil price'],
  [/\bkesehatan(?:nya)?\b/gi, 'health'],
  [/\bmedis(?:nya)?\b/gi, 'medical'],
  [/\bkedokteran(?:nya)?\b/gi, 'medicine'],
  [/\bpenyakit(?:nya)?\b/gi, 'disease'],
  [/\bvaksin(?:nya)?\b/gi, 'vaccine'],
  [/\bobat(?:nya)?\b/gi, 'treatment medication'],
  [/\bkanker(?:nya)?\b/gi, 'cancer treatment'],
  [/\bteknologi(?:nya)?\b/gi, 'technology'],
  [/\bsains(?:nya)?\b/gi, 'science'],
  [/\bilmiah(?:nya)?\b/gi, 'scientific'],
  [/\bcuaca(?:nya)?\b/gi, 'weather'],
  [/\bbadai(?:nya)?\b/gi, 'storm'],
  [/\bgempa(?:nya)?\b/gi, 'earthquake'],
  [/\bbanjir(?:nya)?\b/gi, 'flood'],
  [/\btsunami(?:nya)?\b/gi, 'tsunami'],
  [/\bperang(?:nya)?\b/gi, 'war conflict'],
  [/\bsenjata(?:nya)?\b/gi, 'weapons'],
  [/\bmiliter(?:nya)?\b/gi, 'military'],
  [/\bpemerintah(?:nya)?\b/gi, 'government'],
  [/\bkebijakan(?:nya)?\b/gi, 'policy'],
  [/\bhukum(?:nya)?\b/gi, 'law'],
  [/\baturan(?:nya)?\b/gi, 'regulations'],
  [/\bputusan(?:nya)?\b/gi, 'ruling'],
  [/\bdunia(?:nya)?\b/gi, 'world'],
  [/\bglobal(?:nya)?\b/gi, 'global'],
  [/\binternasional(?:nya)?\b/gi, 'international'],
  [/\bindustri(?:nya)?\b/gi, 'industry'],
  [/\bperusahaan(?:nya)?\b/gi, 'companies'],
  [/\bpasar(?:nya)?\b/gi, 'market'],
  [/\bmobil(?:nya)?\b/gi, 'cars'],
  [/\bkendaraan(?:nya)?\b/gi, 'vehicles'],
  [/\bpesawat(?:nya)?\b/gi, 'aircraft'],
  [/\brobot(?:nya)?\b/gi, 'robotics'],
  [/\brobotika(?:nya)?\b/gi, 'robotics'],
  [/\bfaktor(?:nya)?\b/gi, 'factors'],
  [/\bpenyebab(?:nya)?\b/gi, 'causes'],
  [/\bdampak(?:nya)?\b/gi, 'impacts'],
  [/\balasan(?:nya)?\b/gi, 'reasons'],
  [/\bpenjelasan(?:nya)?\b/gi, 'explanation'],
  [/\banalisis(?:nya)?\b/gi, 'analysis'],
  [/\bkeamanan(?:nya)?\b/gi, 'security'],
  [/\bkecepatan(?:nya)?\b/gi, 'speed'],
  [/\bkinerja(?:nya)?\b/gi, 'performance'],
  [/\bterbaik(?:nya)?\b/gi, 'best'],
  [/\btercepat(?:nya)?\b/gi, 'fastest'],
  [/\bterbesar(?:nya)?\b/gi, 'biggest'],
  [/\bpemenang(?:nya)?\b/gi, 'winner'],
  [/\bjuara(?:nya)?\b/gi, 'champion'],
  [/\bkondisi(?:nya)?\b/gi, 'conditions'],
  [/\bkeadaan(?:nya)?\b/gi, 'state condition'],
  [/\bbaterai(?:nya)?\b/gi, 'battery'],
  [/\benergi(?:nya)?\b/gi, 'energy'],
  [/\bliga(?:nya)?\b/gi, 'league'],
  [/\bfungsi(?:nya)?\b/gi, 'functionality'],
  [/\barti(?:nya)?\b/gi, 'meaning definition'],
  [/\bmaksud(?:nya)?\b/gi, 'definition'],
  [/\bcontoh(?:nya)?\b/gi, 'examples'],
  [/\bpenggunaan(?:nya)?\b/gi, 'usage'],
  [/\bpenerapan(?:nya)?\b/gi, 'application'],
  [/\bsekarang\b/gi, 'now']
];

const GLOBAL_SEARCH_STOPWORDS = /\b(apa|apakah|siapa|siapakah|bagaimana|bagaimanakah|gimana|gimanakah|mengapa|kenapa|kapan|dimana|ke mana|di mana|dari mana|mana|berapa|seperti|kayak|yang|dan|atau|tetapi|namun|dengan|untuk|bagi|pada|di|ke|dari|tentang|mengenai|soal|terkait|adalah|ialah|yaitu|yakni|merupakan|bisa|dapat|tolong|coba|carikan|cari|bantu|tampilkan|berikan|sebutkan|jelaskan|paparkan|terangkan|ceritakan|nya|kah|lah|saja|pun|dong|sih|kok|deh|ya|kan|ada|sudah|telah|sedang|lagi|akan|pernah|kalian|kamu|anda|kita|saya|nih|tuh|lho|loh|kira|kira-kira)\b/gi;

function translateIndoQueryToGlobalEnglish(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') return '';
  const trimmed = rawQuery.trim();
  if (!trimmed) return '';

  // 1. Jika query eksplisit meminta data domestik Indonesia, jangan diterjemahkan ke kueri global
  if (isExplicitDomesticIndoQuery(trimmed)) {
    return trimmed;
  }

  // 2. Jika tidak ada kata bahasa Indonesia sama sekali, pertahankan kueri asli
  if (!hasIndonesianWords(trimmed)) {
    return trimmed;
  }

  let translated = trimmed;

  // 3. Ganti frasa majemuk terlebih dahulu
  for (const [regex, replacement] of GLOBAL_SEARCH_PHRASE_DICT) {
    translated = translated.replace(regex, replacement);
  }

  // 4. Ganti kata-kata individual
  for (const [regex, replacement] of GLOBAL_SEARCH_WORD_DICT) {
    translated = translated.replace(regex, replacement);
  }

  // 5. Bersihkan stopwords / partikel bahasa Indonesia
  translated = translated.replace(GLOBAL_SEARCH_STOPWORDS, ' ');

  // 6. Normalisasi spasi dan tanda baca
  translated = translated
    .replace(/[^\p{L}\p{N}\s\.\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 7. Deduplikasi kata berturut-turut yang identik
  const words = translated.split(/\s+/).filter(Boolean);
  const dedupedWords = [];
  for (const w of words) {
    const last = dedupedWords[dedupedWords.length - 1];
    if (!last || last.toLowerCase() !== w.toLowerCase()) {
      dedupedWords.push(w);
    }
  }
  const result = dedupedWords.join(' ').trim();

  return result.length >= 2 ? result : trimmed;
}

// Helper to perform quick web search via Serper Google Search API
function performWebSearch(query, apiKey = null, num = 15) {
  return new Promise((resolve) => {
    let settled = false;
    const safeResolve = (data) => {
      if (!settled) {
        settled = true;
        resolve(data);
      }
    };

    if (!query || typeof query !== 'string' || !query.trim()) {
      return safeResolve({ query: '', count: 0, results: [] });
    }
    const cleanQuery = query.trim();
    const isDomestic = isExplicitDomesticIndoQuery(cleanQuery);
    const englishQuery = translateIndoQueryToGlobalEnglish(cleanQuery);
    const targetSearchQuery = (!isDomestic && englishQuery) ? englishQuery : cleanQuery;

    const targetNum = Math.min(Math.max(parseInt(num, 10) || 15, 1), 30);
    const serperKey = apiKey || process.env.SERPER_API_KEY || null;
    if (!serperKey) {
      return safeResolve({ query: targetSearchQuery, count: 0, results: [], error: 'SERPER_API_KEY belum dikonfigurasi di server. Set env SERPER_API_KEY atau masukkan key di Pengaturan.' });
    }
    const postData = JSON.stringify({
      q: targetSearchQuery,
      num: targetNum,
      gl: isDomestic ? 'id' : 'us', // Prioritaskan domain/region Indonesia HANYA jika kueri eksplisit domestik
      hl: isDomestic ? 'id' : 'en'  // Global Language Ranking default
    });

    const options = {
      hostname: 'google.serper.dev',
      port: 443,
      path: '/search',
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);

          if (res.statusCode >= 400 || (parsed.message && !Array.isArray(parsed.organic))) {
            const errMsg = parsed.message || (parsed.error ? (typeof parsed.error === 'object' ? parsed.error.message : parsed.error) : `Serper HTTP ${res.statusCode} Error`);
            return safeResolve({ query: cleanQuery, count: 0, results: [], error: errMsg });
          }

          const results = [];
          
          if (parsed.knowledgeGraph) {
            const kgDom = extractDomainSafe(parsed.knowledgeGraph.website || parsed.knowledgeGraph.descriptionUrl || 'https://google.com');
            results.push({
              title: parsed.knowledgeGraph.title || 'Knowledge Graph Fact',
              url: parsed.knowledgeGraph.website || parsed.knowledgeGraph.descriptionUrl || 'https://google.com',
              snippet: `${parsed.knowledgeGraph.type ? '[' + parsed.knowledgeGraph.type + '] ' : ''}${parsed.knowledgeGraph.description || ''}`,
              domain: kgDom,
              sourceProvider: `Google KG (${kgDom})`,
              timestamp: Date.now(),
              pubDate: 'Terkini',
              type: 'knowledgeGraph'
            });
          }

          if (parsed.answerBox) {
            const abDom = extractDomainSafe(parsed.answerBox.link || 'https://google.com');
            results.push({
              title: parsed.answerBox.title || 'Jawaban Teratas',
              url: parsed.answerBox.link || 'https://google.com',
              snippet: parsed.answerBox.answer || parsed.answerBox.snippet || '',
              domain: abDom,
              sourceProvider: `Google AnswerBox (${abDom})`,
              timestamp: Date.now(),
              pubDate: 'Terkini',
              type: 'answerBox'
            });
          }

          if (Array.isArray(parsed.organic)) {
            parsed.organic.forEach((item, idx) => {
              if (!item || !item.link) return;
              const dom = extractDomainSafe(item.link);
              const normUrl = item.link.trim().toLowerCase().replace(/\/$/, '');
              const normTitle = (item.title || '').trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');

              if (!isDomestic) {
                const isSpam = /\b(pluang|riaugreen|inforiau|riaupos|tribunnews|detik|kompas|liputan6|suara|merdeka|sindonews|viva|inews|kumparan|jpnn|kapanlagi|idntimes)\b/i.test(normUrl) || /\b(pluang|riaugreen)\b/i.test(dom || '');
                if (isSpam) return;
              }
              if (normTitle.includes('listofapplecodenames') && !cleanQuery.toLowerCase().includes('apple')) return;
              if (normTitle.includes('jalanbesar') && !cleanQuery.toLowerCase().includes('jalan')) return;

              results.push({
                title: item.title || `Hasil ${idx + 1}`,
                url: item.link || '',
                snippet: item.snippet || '',
                date: item.date || null,
                pubDate: item.date || 'Terkini',
                domain: dom,
                sourceProvider: `Google (${dom})`,
                timestamp: item.date ? (Date.parse(item.date) || Date.now()) : Date.now()
              });
            });

            results.sort((a, b) => {
              const aRep = REPUTABLE_TECH_DOMAINS.has(a.domain) ? 1 : 0;
              const bRep = REPUTABLE_TECH_DOMAINS.has(b.domain) ? 1 : 0;
              if (aRep !== bRep) return bRep - aRep;
              return (b.timestamp || 0) - (a.timestamp || 0);
            });
          }

          safeResolve({
            query: cleanQuery,
            count: results.length,
            knowledgeGraph: parsed.knowledgeGraph || null,
            answerBox: parsed.answerBox || null,
            organic: results,
            results: results
          });
        } catch (e) {
          safeResolve({ query: cleanQuery, count: 0, results: [], error: e.message });
        }
      });

      res.on('error', (err) => {
        safeResolve({ query: cleanQuery, count: 0, results: [], error: err.message });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      safeResolve({ query: cleanQuery, count: 0, results: [], error: 'Serper search timed out' });
    });

    req.on('error', (err) => {
      safeResolve({ query: cleanQuery, count: 0, results: [], error: err.message });
    });

    req.write(postData);
    req.end();
  });
}


// Helper to normalize Ollama/API endpoints
function normalizeEndpoint(ep) {
  if (!ep || typeof ep !== 'string' || !ep.trim()) return 'http://127.0.0.1:11434';
  let clean = ep.trim();
  if (!/^https?:\/\//i.test(clean)) {
    clean = (clean.includes(':443') || clean.includes('ollama.com') || clean.includes('.com') || clean.includes('.io') || clean.includes('.ai') || clean.includes('.app')) 
      ? `https://${clean}` 
      : `http://${clean}`;
  }
  return clean.replace(/\/+$/, '');
}

// Helper to resolve Ollama target paths while preserving reverse proxy / sub-paths
function resolveEndpointUrl(baseEndpoint, targetPath) {
  const norm = normalizeEndpoint(baseEndpoint);
  const parsed = new URL(norm);
  let curPath = parsed.pathname.replace(/\/+$/, '');
  const cleanTarget = targetPath.replace(/^\/+/, '');
  if (curPath.endsWith('/' + cleanTarget) || curPath === '/' + cleanTarget) return parsed;
  if (curPath.endsWith('/api') && cleanTarget.startsWith('api/')) curPath = curPath.slice(0, -4);
  if (curPath.endsWith('/v1') && cleanTarget.startsWith('v1/')) curPath = curPath.slice(0, -3);
  parsed.pathname = path.posix.join(curPath || '/', cleanTarget);
  return parsed;
}

// ==================== YOUTUBE OEMBED METADATA GROUNDING ENGINE ====================
const YOUTUBE_ALLOWED_HOSTS = new Set([
  'youtu.be',
  'www.youtu.be',
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com'
]);

const YOUTUBE_URL_REGEX = /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)?/gi;

const YOUTUBE_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 jam TTL
const youtubeInfoCache = new Map();

function extractYouTubeVideoIds(text) {
  if (!text || typeof text !== 'string') return [];
  const ids = [];
  let match;
  const re = new RegExp(YOUTUBE_URL_REGEX);
  while ((match = re.exec(text)) !== null) {
    if (match[1] && !ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }
  return ids;
}

async function fetchYouTubeInfo(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('URL video YouTube tidak valid');
  }

  let clean = rawUrl.trim();
  let parsedUrl;
  try {
    if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
    parsedUrl = new URL(clean);
  } catch (e) {
    throw new Error('Format URL tidak valid: ' + e.message);
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!YOUTUBE_ALLOWED_HOSTS.has(hostname)) {
    throw new Error(`Host '${hostname}' tidak diizinkan. Hanya URL YouTube resmi yang diizinkan (youtu.be, youtube.com).`);
  }

  if (isPrivateHost(hostname, parsedUrl.port)) {
    throw new Error('Akses ke alamat IP lokal/privat diblokir.');
  }

  // Canonicalize to standard watch URL
  let videoId = null;
  const match = parsedUrl.href.match(/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (match && match[1]) {
    videoId = match[1];
  }

  const canonicalUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : parsedUrl.href;
  if (youtubeInfoCache.has(canonicalUrl)) {
    const cached = youtubeInfoCache.get(canonicalUrl);
    if (cached && (Date.now() - cached.cachedAt < YOUTUBE_CACHE_TTL)) {
      return cached.data;
    }
    youtubeInfoCache.delete(canonicalUrl);
  }

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;

  return new Promise((resolve) => {
    let settled = false;
    const safeResolve = (data) => {
      if (!settled) {
        settled = true;
        resolve(data);
      }
    };

    const req = https.get(oembedUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    }, (res) => {
      if (res.statusCode === 404) {
        res.resume();
        return safeResolve({
          success: false,
          error: 'Video YouTube tidak ditemukan atau berstatus privat/dihapus (HTTP 404).',
          url: canonicalUrl,
          videoId: videoId
        });
      }
      if (res.statusCode !== 200) {
        res.resume();
        return safeResolve({
          success: false,
          error: `Gagal mengambil data dari YouTube oEmbed (HTTP ${res.statusCode})`,
          url: canonicalUrl,
          videoId: videoId
        });
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const result = {
            success: true,
            url: canonicalUrl,
            videoId: videoId,
            title: parsed.title || 'Tanpa Judul',
            channel: parsed.author_name || 'Kreator YouTube',
            channel_url: parsed.author_url || '',
            thumbnail: parsed.thumbnail_url || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''),
            type: parsed.type || 'video',
            html: parsed.html || ''
          };
          if (youtubeInfoCache.size > 200) {
            const firstKey = youtubeInfoCache.keys().next().value;
            youtubeInfoCache.delete(firstKey);
          }
          youtubeInfoCache.set(canonicalUrl, { data: result, cachedAt: Date.now() });
          safeResolve(result);
        } catch (e) {
          safeResolve({
            success: false,
            error: 'Gagal mengurai respons JSON YouTube oEmbed: ' + e.message,
            url: canonicalUrl,
            videoId: videoId
          });
        }
      });

      res.on('error', (err) => {
        safeResolve({
          success: false,
          error: 'Network error YouTube oEmbed stream: ' + err.message,
          url: canonicalUrl,
          videoId: videoId
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      safeResolve({
        success: false,
        error: 'Timeout saat menghubungi YouTube oEmbed (8s).',
        url: canonicalUrl,
        videoId: videoId
      });
    });

    req.on('error', (err) => {
      safeResolve({
        success: false,
        error: 'Network error YouTube oEmbed: ' + err.message,
        url: canonicalUrl,
        videoId: videoId
      });
    });
  });
}

// Universal Grounding Enricher: injects real-time YouTube metadata for 100% of LLM models
async function enrichTextWithYouTubeContext(text) {
  if (!text || typeof text !== 'string') return { text, youtubeVideos: [] };
  const ids = extractYouTubeVideoIds(text);
  if (ids.length === 0) return { text, youtubeVideos: [] };

  const results = await Promise.all(ids.map(id => {
    return Promise.resolve()
      .then(() => fetchYouTubeInfo(`https://www.youtube.com/watch?v=${id}`))
      .catch(() => null);
  }));
  const validVideos = results.filter(r => r && r.success);
  if (validVideos.length === 0) return { text, youtubeVideos: [] };

  const contextBlocks = validVideos.map((v, idx) => {
    return `[DATA TERVERIFIKASI VIDEO YOUTUBE #${idx + 1}]
- URL: ${v.url}
- Judul Video: "${v.title}"
- Nama Channel / Pembuat: "${v.channel}" (${v.channel_url || 'N/A'})
- Thumbnail: ${v.thumbnail}
- Status Transkrip: Tidak tersedia dalam metadata oEmbed.
(Informasi resmi ini diambil secara real-time via endpoint YouTube oEmbed)`;
  }).join('\n\n');

  const groundingPrompt = `\n\n### DATA METADATA RESMI YOUTUBE (VERIFIED GROUNDING):
${contextBlocks}

### PANDUAN INTEGRITAS & ANTI-HALUSINASI UNTUK ASISTEN AI:
1. Informasi di atas adalah metadata resmi terverifikasi real-time via YouTube oEmbed.
2. BATASAN DATA: Data di atas HANYA memuat judul dan nama channel/kreator, dan TIDAK MEMUAT transkrip/rekaman isi suara video.
3. DILARANG BERHALUSINASI: Dilarang mengarang, menebak, atau mereka-reka isi dialog, kesimpulan, atau alur adegan detail dari video di atas semata-mata berdasarkan judulnya.
4. JAWABAN JUJUR: Jika pengguna meminta "Rangkum isi video ini" atau "Apa kesimpulan video ini?", jelaskan fakta judul dan kreatornya, lalu sampaikan secara transparan kepada pengguna bahwa transkrip penuh percakapan di dalam video tidak tersedia.`;

  return {
    text: text + groundingPrompt,
    youtubeVideos: validVideos,
    groundingContext: groundingPrompt
  };
}

// ==================== YOUTUBE LIVE SEARCH ENGINE (ZERO API KEY) ====================
// Mencari video YouTube tanpa API key dengan dua strategi fallback:
//   1) Parsing halaman hasil pencarian YouTube (ytInitialData) — utama.
//   2) Instance Invidious publik (API JSON terbuka) — cadangan.
const youtubeSearchCache = new Map();
const YOUTUBE_SEARCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.nerdvpn.de'
];

// "12:34" / "1:02:03" -> detik
function youtubeDurationToSeconds(text) {
  if (!text || typeof text !== 'string') return 0;
  const parts = text.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

// Ambil objek JSON seimbang yang mengikuti sebuah penanda (mis. "ytInitialData =")
function extractJsonAfterMarker(source, marker) {
  if (!source || typeof source !== 'string') return null;
  const idx = source.indexOf(marker);
  if (idx === -1) return null;
  const start = source.indexOf('{', idx + marker.length);
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

function ytText(node) {
  if (!node) return '';
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map((r) => (r && r.text) || '').join('');
  if (typeof node.content === 'string') return node.content;
  return '';
}

function mapVideoRenderer(vr) {
  try {
    if (!vr || !vr.videoId) return null;
    const title = ytText(vr.title);
    if (!title) return null;
    const ownerRuns = vr.ownerText && vr.ownerText.runs;
    const ownerNav = ownerRuns && ownerRuns[0] && ownerRuns[0].navigationEndpoint && ownerRuns[0].navigationEndpoint.browseEndpoint;
    const channelPath = ownerNav && ownerNav.canonicalBaseUrl;
    const durationText = ytText(vr.lengthText);
    return {
      videoId: vr.videoId,
      title,
      channel: ytText(vr.ownerText || vr.longBylineText) || '',
      channelUrl: channelPath ? `https://www.youtube.com${channelPath}` : '',
      durationText,
      durationSeconds: youtubeDurationToSeconds(durationText),
      viewText: ytText(vr.viewCountText) || ytText(vr.shortViewCountText),
      publishedText: ytText(vr.publishedTimeText),
      description: ytText(vr.descriptionSnippet).slice(0, 260),
      url: `https://www.youtube.com/watch?v=${vr.videoId}`,
      thumbnail: `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`,
      source: 'YouTube Search'
    };
  } catch (_) {
    return null;
  }
}

// YouTube versi baru memakai lockupViewModel (contentType VIDEO) alih-alih videoRenderer
function mapLockupViewModel(lv) {
  try {
    if (!lv || !lv.contentId) return null;
    const meta = (lv.metadata && lv.metadata.lockupMetadataViewModel) || {};
    const title = (meta.title && meta.title.content) || '';
    if (!title) return null;
    const metaLine = (meta.metadata && meta.metadata.content) || '';
    const sources = (meta.image && meta.image.thumbnailSources) || [];
    let thumb = '';
    for (const s of sources) {
      if (s && typeof s.url === 'string' && /hqdefault|mqdefault|maxresdefault/i.test(s.url)) { thumb = s.url; break; }
    }
    if (!thumb && sources.length && sources[0].url) thumb = sources[0].url;
    if (thumb && thumb.startsWith('//')) thumb = `https:${thumb}`;
    if (thumb && thumb.startsWith('/')) thumb = `https://i.ytimg.com${thumb}`;
    return {
      videoId: lv.contentId,
      title,
      channel: '',
      channelUrl: '',
      durationText: '',
      durationSeconds: 0,
      viewText: metaLine,
      publishedText: '',
      description: metaLine.slice(0, 260),
      url: `https://www.youtube.com/watch?v=${lv.contentId}`,
      thumbnail: thumb || `https://i.ytimg.com/vi/${lv.contentId}/hqdefault.jpg`,
      source: 'YouTube Search'
    };
  } catch (_) {
    return null;
  }
}

// Telusuri struktur ytInitialData rekursif dan kumpulkan video yang sudah dinormalisasi
function collectYouTubeSearchResults(node, out, limit) {
  if (!node || typeof node !== 'object' || out.length >= limit) return;
  if (Array.isArray(node)) {
    for (const item of node) {
      collectYouTubeSearchResults(item, out, limit);
      if (out.length >= limit) return;
    }
    return;
  }
  if (node.videoRenderer) {
    const mapped = mapVideoRenderer(node.videoRenderer);
    if (mapped && !out.some((v) => v.videoId === mapped.videoId)) out.push(mapped);
    if (out.length >= limit) return;
  }
  if (node.lockupViewModel && node.lockupViewModel.contentId && String(node.lockupViewModel.contentType || '').toUpperCase().includes('VIDEO')) {
    const mapped = mapLockupViewModel(node.lockupViewModel);
    if (mapped && !out.some((v) => v.videoId === mapped.videoId)) out.push(mapped);
    if (out.length >= limit) return;
  }
  for (const key of Object.keys(node)) {
    collectYouTubeSearchResults(node[key], out, limit);
    if (out.length >= limit) return;
  }
}

async function searchViaYouTubeResultsPage(query, limit) {
  const target = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&gl=US`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const resp = await fetch(target, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': YOUTUBE_SEARCH_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'SOCS=CAI'
      }
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const jsonStr = extractJsonAfterMarker(html, 'ytInitialData');
    if (!jsonStr) return [];
    const data = JSON.parse(jsonStr);
    const results = [];
    collectYouTubeSearchResults(data, results, limit);
    return results;
  } catch (_) {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function searchViaInvidious(query, limit) {
  const seenIds = new Set();
  for (const base of INVIDIOUS_INSTANCES) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const resp = await fetch(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
        signal: ctrl.signal,
        headers: { 'Accept': 'application/json', 'User-Agent': YOUTUBE_SEARCH_UA }
      });
      if (!resp.ok) continue;
      const list = await resp.json();
      if (!Array.isArray(list)) continue;
      const mapped = list
        .filter((it) => it && (it.type === 'video' || it.videoId) && it.videoId && it.title)
        .slice(0, limit)
        .map((it) => ({
          videoId: it.videoId,
          title: it.title,
          channel: it.author || '',
          channelUrl: it.authorUrl ? (String(it.authorUrl).startsWith('http') ? it.authorUrl : `${base}${it.authorUrl}`) : '',
          durationText: '',
          durationSeconds: Number(it.lengthSeconds) || 0,
          viewText: Number(it.viewCount) > 0 ? `${Number(it.viewCount).toLocaleString('en-US')} views` : '',
          publishedText: it.publishedText || '',
          description: String(it.description || '').slice(0, 260),
          url: `https://www.youtube.com/watch?v=${it.videoId}`,
          thumbnail: `https://i.ytimg.com/vi/${it.videoId}/hqdefault.jpg`,
          source: 'Invidious'
        }));
      const fresh = mapped.filter((v) => {
        if (!v.videoId || seenIds.has(v.videoId)) return false;
        seenIds.add(v.videoId);
        return true;
      });
      if (fresh.length) return fresh;
    } catch (_) {
      // lanjut ke instance berikutnya
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
}

// Lengkapi data video (khususnya nama channel) via oEmbed bila belum ada.
async function enrichYouTubeSearchResults(results) {
  const missing = results.filter((v) => !v.channel);
  if (missing.length === 0) return results;
  await Promise.all(missing.map(async (v) => {
    try {
      const info = await fetchYouTubeInfo(v.url);
      if (info && info.success && info.channel) {
        v.channel = info.channel;
        v.channelUrl = info.channel_url || v.channelUrl;
        if (!v.title && info.title) v.title = info.title;
        if (!v.thumbnail && info.thumbnail) v.thumbnail = info.thumbnail;
      }
    } catch (_) {}
  }));
  return results;
}

/**
 * Cari video YouTube secara live tanpa API key.
 * @param {string} query kata kunci pencarian
 * @param {number} maxResults jumlah hasil (1-10)
 * @returns {Promise<{success:boolean, query:string, count:number, results:Array, error?:string}>}
 */
async function searchYouTubeVideos(query, maxResults = 6) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Parameter query tidak boleh kosong.');
  const limit = Math.max(1, Math.min(10, parseInt(maxResults, 10) || 6));
  const cacheKey = `${q.toLowerCase()}::${limit}`;
  if (youtubeSearchCache.has(cacheKey)) {
    const cached = youtubeSearchCache.get(cacheKey);
    if (cached && (Date.now() - cached.cachedAt < YOUTUBE_CACHE_TTL)) {
      return cached.data;
    }
    youtubeSearchCache.delete(cacheKey);
  }

  let results = await searchViaYouTubeResultsPage(q, limit);
  if (results.length === 0) {
    results = await searchViaInvidious(q, limit);
  }
  if (results.length > 0) {
    results = await enrichYouTubeSearchResults(results);
  }

  const payload = {
    success: results.length > 0,
    query: q,
    count: results.length,
    results,
    error: results.length > 0 ? undefined : 'Tidak ditemukan hasil video. Coba kata kunci lain.'
  };
  if (results.length > 0) {
    if (youtubeSearchCache.size > 80) {
      const first = youtubeSearchCache.keys().next().value;
      youtubeSearchCache.delete(first);
    }
    youtubeSearchCache.set(cacheKey, { data: payload, cachedAt: Date.now() });
  }
  return payload;
}

function pruneYouTubeCaches() {
  try {
    const now = Date.now();
    for (const [key, val] of youtubeInfoCache.entries()) {
      if (!val || !val.cachedAt || (now - val.cachedAt >= YOUTUBE_CACHE_TTL)) {
        youtubeInfoCache.delete(key);
      }
    }
    for (const [key, val] of youtubeSearchCache.entries()) {
      if (!val || !val.cachedAt || (now - val.cachedAt >= YOUTUBE_CACHE_TTL)) {
        youtubeSearchCache.delete(key);
      }
    }
  } catch (_) {}
}
setInterval(pruneYouTubeCaches, 30 * 60 * 1000).unref();

// ==================== DEEP RESEARCH AUTONOMOUS ENGINE (PREMIUM) ====================
const dbTugasRiset = {};

// Cleanup & Memory Management for Deep Research Tasks (LRU + TTL 1 hour)
function pruneResearchTasks() {
  try {
    const MAX_TASKS = 40;
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();
    const taskIds = Object.keys(dbTugasRiset);

    // 1. Bersihkan tugas yang sudah lebih dari 1 jam
    for (const id of taskIds) {
      const task = dbTugasRiset[id];
      if (task && task.createdAt) {
        const age = now - new Date(task.createdAt).getTime();
        if (age > ONE_HOUR_MS) {
          delete dbTugasRiset[id];
        }
      }
    }

    // 2. Jika masih melebihi batas MAX_TASKS, buang tugas tertua
    const remainingKeys = Object.keys(dbTugasRiset);
    if (remainingKeys.length > MAX_TASKS) {
      const sorted = remainingKeys
        .map(id => dbTugasRiset[id])
        .filter(Boolean)
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

      const toRemove = sorted.slice(0, remainingKeys.length - MAX_TASKS);
      for (const t of toRemove) {
        delete dbTugasRiset[t.taskId];
      }
    }
  } catch (e) {
    console.warn('Warning pruning research tasks:', e.message);
  }
}

// Timer pembersihan berkala setiap 15 menit
setInterval(pruneResearchTasks, 15 * 60 * 1000).unref();

// ==================== BACKGROUND PERSISTENT CHAT ENGINE (CLAUDE AI RESILIENCE) ====================
// Mengizinkan AI terus menyelesaikan respons dan menyimpan jawaban ke disk sesi
// meskipun pengguna menutup tab peramban, meminimalkan aplikasi, atau keluar dari sesi (seperti Claude AI).
// null-prototype: sessionId attacker yang lolos regex ('__proto__', 'constructor')
// menjadi properti data BIASA, bukan pemicu prototype pollution (M21).
const dbActiveChatTasks = Object.create(null); // sessionId -> { taskId, sessionId, model, fullText, rawBuffer, status, startedAt, completedAt, proxyReq }

// Kunci task wajib format aman; nilai tak valid → null (tanpa persistensi latar),
// alih-alih dipakai mentah sebagai property key.
function sanitizeTaskKey(sid) {
  if (!sid || typeof sid !== 'string') return null;
  const s = sid.trim();
  return (/^[a-zA-Z0-9_-]{1,128}$/.test(s)) ? s : null;
}

// F12: jeda minimum antar spawn `ollama serve` (endpoint tak ber-auth).
let lastOllamaSpawnAt = 0;

// F19: catat exception terakhir untuk /api/health agar kegagalan di luar request
// tetap teramati tanpa harus membuka log (proses sengaja dipertahankan hidup).
let lastUncaughtInfo = null;

// ===== RATE LIMITER IN-MEMORI PER-IP (M22) =====
// Window geser 60 detik. Tanpa ini, loop permintaan bisa menghabiskan memori
// (body 50MB × paralel) dan mengisi disk lewat POST /api/sessions tanpa batas.
// Sesuaikan lewat env ZOX_RATE_GENERAL / ZOX_RATE_SESSIONS bila perlu.
const RATE_LIMIT_GENERAL = { name: 'general', windowMs: 60000, max: Number(process.env.ZOX_RATE_GENERAL) || 300 };
const RATE_LIMIT_SESSION_WRITE = { name: 'sessions', windowMs: 60000, max: Number(process.env.ZOX_RATE_SESSIONS) || 60 };
const rateBuckets = new Map(); // "ip|namaLimiter" -> { count, resetAt }

// Normalisasi IP: hapus zone ID IPv6 (%eth0), mapped IPv4 (::ffff:), bracket IPv6
function normalizeIp(ip) {
  if (!ip || typeof ip !== 'string') return 'unknown';
  let cleaned = ip.trim();
  // Hapus zone ID IPv6 (e.g., "::1%eth0" -> "::1")
  const zoneIdx = cleaned.indexOf('%');
  if (zoneIdx !== -1) cleaned = cleaned.slice(0, zoneIdx);
  // Hapus bracket IPv6 (e.g., "[::1]" -> "::1")
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) cleaned = cleaned.slice(1, -1);
  // IPv4-mapped IPv6 (e.g., "::ffff:192.168.1.1" -> "192.168.1.1")
  // Handle all IPv4-mapped IPv6 formats: ::ffff:x:x or ::ffff:0:x.x.x.x
  if (cleaned.startsWith('::ffff:')) {
    const mapped = cleaned.slice(7);
    // If it contains dots, it's already in IPv4 format (::ffff:192.168.1.1)
    if (mapped.includes('.')) {
      cleaned = mapped;
    } else {
      // Convert hex IPv4-mapped (::ffff:c0a8:0101 -> 192.168.1.1)
      const parts = mapped.split(':');
      if (parts.length === 2) {
        const high = parseInt(parts[0], 16);
        const low = parseInt(parts[1], 16);
        if (!isNaN(high) && !isNaN(low)) {
          cleaned = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        }
      }
    }
  }
  // IPv4-compat IPv6 (deprecated but handle anyway): ::c0a8:0101 -> 192.168.1.1
  else if (cleaned.startsWith('::') && cleaned.includes(':') && !cleaned.startsWith('::ffff:')) {
    const parts = cleaned.split(':');
    // Handle ::a:b:c:d format (last two hextets = IPv4)
    if (parts.length >= 3 && parts[0] === '' && parts[1] === '') {
      const lastTwo = parts.slice(-2);
      if (lastTwo.length === 2 && lastTwo.every(p => /^[0-9a-fA-F]{1,4}$/.test(p))) {
        const high = parseInt(lastTwo[0], 16);
        const low = parseInt(lastTwo[1], 16);
        if (!isNaN(high) && !isNaN(low) && high <= 0xffff && low <= 0xffff) {
          cleaned = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        }
      }
    }
  }
  return cleaned;
}

function rateLimitCheck(req, limit) {
  let rawIp = (req.socket && req.socket.remoteAddress) || 'unknown';
  // Di belakang proxy tepercaya (Vercel / TRUST_PROXY=1), semua request datang
  // dari IP proxy yang sama → bucket tunggal. Pakai hop PALING KANAN x-forwarded-for:
  // entri itulah yang DITAMBAHKAN oleh proxy tepercaya (IP yang benar-benar ia
  // lihat dari koneksi masuk) dan tidak bisa dikontrol klien dari luar. Hop kiri
  // (first-hop) justru kolom bebas yang bisa diisi attacker lewat header XFF palsu
  // — bila dipakai sebagai kunci, rate-limit bisa dibobol total (bucket baru tiap
  // request). DI LUAR proxy tepercaya header XFF diabaikan total (tetap
  // remoteAddress) agar tidak bisa di-bypass dari LAN.
  const xffHeader = req.headers && req.headers['x-forwarded-for'];
  const trustedProxy = process.env.TRUST_PROXY === '1' ||
    (IS_VERCEL_ENV && typeof xffHeader === 'string' && xffHeader.trim() !== '') ||
    (Boolean(process.env.IS_VERCEL_ENV) && typeof xffHeader === 'string' && xffHeader.trim() !== '');
  if (trustedProxy) {
    const hops = String(xffHeader || '').split(',').map(h => h.trim()).filter(Boolean);
    const trustedHop = hops.length ? hops[hops.length - 1] : ''; // hop kanan = tambahan proxy tepercaya
    if (net.isIP(trustedHop)) rawIp = trustedHop; // hanya pakai bila bentuknya IP valid
  }
  const ip = normalizeIp(rawIp);
  const key = ip + '|' + (limit.name || 'x'); // bucket TERPISAH per limiter
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + limit.windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count <= limit.max) return null;
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of rateBuckets) {
    if (now >= b.resetAt) rateBuckets.delete(ip);
  }
}, 60000).unref();

function pruneActiveChatTasks() {
  try {
    const FIFTEEN_MINS = 15 * 60 * 1000;
    // M26: task yang MASIH streaming diberi jangkau 60 menit — dulu semuanya dipotong
    // di 15 menit, sehingga generasi panjang (riset/panjang/jawaban lambat) kehilangan
    // proxyReq-nya di tengah jalan dan parsial tak pernah tersimpan.
    const SIXTY_MINS = 60 * 60 * 1000;
    const now = Date.now();
    for (const sid of Object.keys(dbActiveChatTasks)) {
      const t = dbActiveChatTasks[sid];
      if (t) {
        if (t.status === 'completed' || t.status === 'error' || t.status === 'aborted') {
          delete dbActiveChatTasks[sid];
          continue;
        }
        const ageLimit = t.status === 'streaming' ? SIXTY_MINS : FIFTEEN_MINS;
        if (t.startedAt && (now - t.startedAt > ageLimit)) {
          // Destroy proxy request first to prevent use-after-free
          if (t.proxyReq && !t.proxyReq.destroyed) {
            try { t.proxyReq.destroy(); } catch (_) {}
          }
          // Flush any remaining buffer before deleting.
          if (t.rawBuffer && t.rawBuffer.trim()) flushChatTaskBuffer(sid, t.provider || 'openrouter');
          const partialText = textSafety.stripReasoningText(t.fullText || '');
          if (partialText.trim()) {
            appendAssistantMessageToSessionDisk(sid, partialText + `\n\n*[Respons terputus: Kadaluwarsa]*`, t.model)
              .catch(err => console.warn('Gagal simpan respons kadaluwarsa ke sesi:', err && err.message));
          }
          delete dbActiveChatTasks[sid];
        }
      }
    }
  } catch (e) {
    console.warn('Warning pruning chat tasks:', e.message);
  }
}

setInterval(pruneActiveChatTasks, 10 * 60 * 1000).unref();

const MAX_FULLTEXT_BYTES = 10 * 1024 * 1024; // 10MB limit for accumulated response text

function accumulateChatChunk(sessionId, chunk, provider) {
  if (!sessionId || !dbActiveChatTasks[sessionId]) return;
  const task = dbActiveChatTasks[sessionId];
  const str = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
  task.rawBuffer = (task.rawBuffer || '') + str;
  const lines = task.rawBuffer.split('\n');
  task.rawBuffer = lines.pop(); // simpan sisa baris parsial

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (provider === 'openrouter') {
      let jsonStr = null;
      if (trimmed.startsWith('data:')) {
        jsonStr = trimmed.replace(/^data:\s*/, '').trim();
        if (jsonStr === '[DONE]') continue;
      } else {
        // F14: respons NON-stream (stream:false) = satu objek JSON utuh tanpa
        // awalan 'data:'. Dulu baris ini di-skip → fullText kosong → jawaban
        // tidak pernah dipersist ke file sesi (hilang saat refresh).
        jsonStr = trimmed;
      }
      try {
        const parsed = JSON.parse(jsonStr);
        // Keep answer channel only. Reasoning fields never enter background
        // status text, session persistence, copy, or export.
        const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || parsed.choices?.[0]?.message?.content || '';
        if (delta) {
          // Limit fullText buffer to prevent memory exhaustion on very long responses.
          // Akumulasi byte per-chunk (O(delta)) — byteLength(fullText + delta) yang
          // dulu menyalin seluruh akumulasi setiap chunk (O(n²) total) sudah dihilangkan.
          const deltaBytes = Buffer.byteLength(delta, 'utf8');
          if ((task.fullBytes || 0) + deltaBytes > MAX_FULLTEXT_BYTES) {
            task.fullText = task.fullText.slice(-MAX_FULLTEXT_BYTES / 2); // Keep last half
            task.fullBytes = Buffer.byteLength(task.fullText, 'utf8'); // recompute sekali (peristiwa langka)
            task.fullEpoch = (task.fullEpoch || 0) + 1; // offset byte bergeser → delta epoch lama tak berlaku
          }
          task.fullText += delta;
          task.fullBytes = (task.fullBytes || 0) + deltaBytes;
          task.lastTokenTime = Date.now();
        }
      } catch (_) {}
    } else {
      // Ollama
      try {
        const parsed = JSON.parse(trimmed);
        const delta = parsed.message?.content || parsed.response || '';
        if (delta) {
          // Limit fullText buffer to prevent memory exhaustion on very long responses.
          const deltaBytes = Buffer.byteLength(delta, 'utf8');
          if ((task.fullBytes || 0) + deltaBytes > MAX_FULLTEXT_BYTES) {
            task.fullText = task.fullText.slice(-MAX_FULLTEXT_BYTES / 2); // Keep last half
            task.fullBytes = Buffer.byteLength(task.fullText, 'utf8'); // recompute sekali (peristiwa langka)
            task.fullEpoch = (task.fullEpoch || 0) + 1; // offset byte bergeser → delta epoch lama tak berlaku
          }
          task.fullText += delta;
          task.fullBytes = (task.fullBytes || 0) + deltaBytes;
          task.lastTokenTime = Date.now();
        }
      } catch (_) {}
    }
  }
}

function flushChatTaskBuffer(sessionId, provider) {
  if (!sessionId || !dbActiveChatTasks[sessionId]) return;
  const task = dbActiveChatTasks[sessionId];
  if (task.rawBuffer && task.rawBuffer.trim()) {
    const raw = task.rawBuffer;
    task.rawBuffer = '';
    const lines = raw.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (provider === 'openrouter') {
        let jsonStr = null;
        if (trimmed.startsWith('data:')) {
          jsonStr = trimmed.replace(/^data:\s*/, '').trim();
          if (jsonStr === '[DONE]') continue;
        } else {
          // F14: respons NON-stream (stream:false) = satu objek JSON utuh tanpa
          // awalan 'data:' — baris terakhir yang tertinggal di rawBuffer kini ikut
          // diekstrak (dulu di-skip → jawaban tak pernah dipersist).
          jsonStr = trimmed;
        }
        try {
          const parsed = JSON.parse(jsonStr);
          // Flush akhir juga hanya menyimpan kanal jawaban eksplisit.
          const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || parsed.choices?.[0]?.message?.content || '';
          if (delta) {
            task.fullText += delta;
            task.fullBytes = (task.fullBytes || 0) + Buffer.byteLength(delta, 'utf8');
            task.lastTokenTime = Date.now();
          }
        } catch (_) {}
      } else {
        try {
          const parsed = JSON.parse(trimmed);
          const delta = parsed.message?.content || parsed.response || '';
          if (delta) {
            task.fullText += delta;
            task.fullBytes = (task.fullBytes || 0) + Buffer.byteLength(delta, 'utf8');
            task.lastTokenTime = Date.now();
          }
        } catch (_) {}
      }
    }
  }
}

function markChatTaskInterrupted(sessionId, reason = 'Koneksi terputus') {
  if (!sessionId || !dbActiveChatTasks[sessionId]) return;
  const task = dbActiveChatTasks[sessionId];
  if (task.status === 'aborted' || task.status === 'completed') return;
  task.status = 'error';
  task.error = reason;
  task.completedAt = Date.now();

  // Destroy proxy request first to prevent use-after-free
  if (task.proxyReq && !task.proxyReq.destroyed) {
    try { task.proxyReq.destroy(); } catch (_) {}
  }

  flushChatTaskBuffer(sessionId, task.provider || 'openrouter');
  if (task.fullText && task.fullText.trim()) {
    appendAssistantMessageToSessionDisk(sessionId, task.fullText + `\n\n*[Respons terputus: ${reason}]*`, task.model)
      .catch(err => console.warn('Gagal simpan respons terputus ke sesi:', err && err.message));
  }
  // Clean up completed/interrupted task
  delete dbActiveChatTasks[sessionId];
}

// Antrean tulis file sesi PER sessionId: sejak appendAssistantMessageToSessionDisk
// menjadi asinkron, dua pemanggil konkurent untuk sesi yang sama (prune kadaluarsa +
// completion baru, stop + simpan riset, dsb) bisa sama-sama membaca file LAMA lewat
// await → tulisan terakhir menimpa yang pertama dan satu pesan hilang permanen.
// Rantai promise memaksa read-modify-write berjalan satu per satu per sesi.
const sessionAppendQueues = new Map(); // cleanSid -> Promise tail antrean

function appendAssistantMessageToSessionDisk(sessionId, content, modelName, extraMeta = {}, explicitUserId = null) {
  if (!sessionId || !content || !content.trim()) return Promise.resolve(false);
  // Fail closed for legacy/provider-tagged thought text, regardless of the caller.
  content = textSafety.stripReasoningText(content);
  if (!content.trim()) return Promise.resolve(false);
  try {
    const cleanSid = String(sessionId).trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanSid)) return Promise.resolve(false);

    // Tentukan userId pemilik sesi
    let effectiveUid = explicitUserId;
    if (!effectiveUid && dbActiveChatTasks[cleanSid]?.userId) {
      effectiveUid = dbActiveChatTasks[cleanSid].userId;
    }
    if (!effectiveUid && extraMeta && typeof extraMeta === 'object' && extraMeta.userId) {
      effectiveUid = extraMeta.userId;
    }
    if (!effectiveUid) {
      for (const rId of Object.keys(dbTugasRiset)) {
        const r = dbTugasRiset[rId];
        if (r && (r.sessionId === cleanSid || r.taskId === cleanSid) && r.userId) {
          effectiveUid = r.userId;
          break;
        }
      }
    }
    const cleanUid = sanitizeUserId(effectiveUid || 'default');
    const userDir = getUserSessionsDir(cleanUid);
    const sessFile = path.join(userDir, `${cleanSid}.json`);

    // Tangkap konteks task SEBELUM await pertama — beberapa pemanggil (stop,
    // prune, interrupt) menghapus dbActiveChatTasks tepat setelah memanggil
    // fungsi ini, jadi userPrompt harus dibaca sebelum I/O asinkron pertama.
    let userPrompt = (sessionId && dbActiveChatTasks[sessionId]?.userPrompt) ? dbActiveChatTasks[sessionId].userPrompt : null;
    if (!userPrompt && extraMeta && typeof extraMeta === 'object' && extraMeta.prompt) {
      userPrompt = extraMeta.prompt;
    }
    if (!userPrompt && sessionId) {
      for (const rId of Object.keys(dbTugasRiset)) {
        const r = dbTugasRiset[rId];
        if (r && (r.sessionId === sessionId || r.taskId === sessionId) && r.topik) {
          userPrompt = r.topik;
          break;
        }
      }
    }

    // ===== ANTREAN TULIS PER-SESI =====
    // Konteks (userPrompt & effectiveUid) sudah ditangkap sinkron DI ATAS — sebelum
    // pemanggil (stop/prune) sempat menghapus dbActiveChatTasks. Sekarang RMW
    // file-nya diantrekan per cleanSid agar dua penyimpanan konkurent tidak saling
    // menimpa (lost-update). Antrean tidak pernah reject: error sudah dikonversi
    // false + warn agar tail antrean selalu lanjut ke pemanggil berikutnya.
    const prevTail = sessionAppendQueues.get(cleanSid) || Promise.resolve();
    const tail = prevTail
      .catch(() => {})
      .then(() => _appendSessionFileSerialized(cleanSid, effectiveUid || null, userPrompt, content, modelName, extraMeta))
      .catch(err => {
        console.warn(`[Background Chat Engine] Gagal menyimpan respons asisten ke sesi disk ${sessionId}:`, err && err.message);
        return false;
      })
      .finally(() => {
        if (sessionAppendQueues.get(cleanSid) === tail) sessionAppendQueues.delete(cleanSid);
      });
    sessionAppendQueues.set(cleanSid, tail);
    return tail;
  } catch (err) {
    console.warn(`[Background Chat Engine] Gagal menyimpan respons asisten ke sesi disk ${sessionId}:`, err && err.message);
    return Promise.resolve(false);
  }
}

// ===== BODY RMW FILE SESI — dijalankan HANYA di dalam antrean per-sesi =====
// (lihat rantai antrean di appendAssistantMessageToSessionDisk). Path file dihitung
// ulang di sini karena fungsi induk hanya menangkap konteks, tidak mengeksekusi I/O.
async function _appendSessionFileSerialized(cleanSid, effectiveUid, userPrompt, content, modelName, extraMeta) {
  const userDir = getUserSessionsDir(sanitizeUserId(effectiveUid || 'default'));
  const sessFile = path.join(userDir, `${cleanSid}.json`);

  let sessData = null;
    if (fs.existsSync(sessFile)) {
      try {
        sessData = JSON.parse(await fsp.readFile(sessFile, 'utf8'));
      } catch (_) {
        sessData = null;
      }
    }

    // Jika file sesi fisik belum ada di disk (misal user langsung keluar sesaat setelah kirim pesan),
    // buat otomatis struktur sesi agar jawaban latar belakang tidak hilang dan pertanyaan user tetap ada
    if (!sessData || typeof sessData !== 'object') {
      const initialMsgs = [];

      if (userPrompt) {
        initialMsgs.push({
          id: 'msg_usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          role: 'user',
          content: userPrompt,
          timestamp: new Date(Date.now() - 3000).toISOString()
        });
      }

      let dynamicTitle = 'Percakapan Baru';
      if (userPrompt) {
        const cleanP = String(userPrompt).trim().replace(/^#+\s*/, '');
        const shortP = cleanP.length > 32 ? cleanP.substring(0, 32) + '...' : cleanP;
        if (extraMeta?.isImageGen) {
          dynamicTitle = `🎨 Gambar: ${shortP}`;
        } else if (extraMeta?.isDeepResearch) {
          dynamicTitle = `🔍 Riset: ${shortP}`;
        } else {
          dynamicTitle = shortP;
        }
      }

      sessData = {
        id: cleanSid,
        title: dynamicTitle,
        messages: initialMsgs,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        model: modelName || 'AI Model'
      };
    }
    if (!Array.isArray(sessData.messages)) {
      sessData.messages = [];
    }

    const msgs = sessData.messages;
    const trimmedContent = content.trim();

    // Cek apakah pesan asisten ini sudah tersimpan sebelumnya (hindari duplikasi)
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      const msgAgeMs = lastMsg.timestamp ? (Date.now() - new Date(lastMsg.timestamp).getTime()) : 0;
      const isRecent = msgAgeMs < 10 * 60 * 1000;
      const isSamePrefix = lastMsg.content && trimmedContent.startsWith(lastMsg.content) && (isRecent || lastMsg.backgroundCompleted);

      if (lastMsg.content === trimmedContent || isSamePrefix) {
        lastMsg.content = trimmedContent;
        lastMsg.model = modelName || lastMsg.model;
        lastMsg.backgroundCompleted = true;
        if (extraMeta && typeof extraMeta === 'object') {
          if (extraMeta.isDeepResearch) lastMsg.isDeepResearch = true;
          if (extraMeta.chatSummary) lastMsg.chatSummary = extraMeta.chatSummary;
          if (Array.isArray(extraMeta.sources) && extraMeta.sources.length) lastMsg.sources = extraMeta.sources;
          if (extraMeta.latency) lastMsg.latency = extraMeta.latency;
          if (extraMeta.isImageGen) lastMsg.isImageGen = true;
          if (extraMeta.type) lastMsg.type = extraMeta.type;
          if (extraMeta.imageUrl) lastMsg.imageUrl = extraMeta.imageUrl;
          if (extraMeta.url) lastMsg.url = extraMeta.url;
          if (extraMeta.prompt) lastMsg.prompt = extraMeta.prompt;
          if (extraMeta.width) lastMsg.width = extraMeta.width;
          if (extraMeta.height) lastMsg.height = extraMeta.height;
          if (extraMeta.seed) lastMsg.seed = extraMeta.seed;
        }
        sessData.updatedAt = new Date().toISOString();
        const tempFile = sessFile + `.tmp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        try {
          await fsp.writeFile(tempFile, JSON.stringify(sessData, null, 2), 'utf8');
          safeAtomicRenameSync(tempFile, sessFile);
        } catch (err) {
          try { fs.unlinkSync(tempFile); } catch {}
          throw err;
        }
        return true;
      }
    }

    const newMsg = {
      id: 'msg_bg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      role: 'assistant',
      content: trimmedContent,
      model: modelName || sessData.model || 'AI Model',
      timestamp: new Date().toISOString(),
      backgroundCompleted: true
    };

    if (extraMeta && typeof extraMeta === 'object') {
      if (extraMeta.isDeepResearch) newMsg.isDeepResearch = true;
      if (extraMeta.chatSummary) newMsg.chatSummary = extraMeta.chatSummary;
      if (Array.isArray(extraMeta.sources) && extraMeta.sources.length) newMsg.sources = extraMeta.sources;
      if (extraMeta.latency) newMsg.latency = extraMeta.latency;
      if (extraMeta.isImageGen) newMsg.isImageGen = true;
      if (extraMeta.type) newMsg.type = extraMeta.type;
      if (extraMeta.imageUrl) newMsg.imageUrl = extraMeta.imageUrl;
      if (extraMeta.url) newMsg.url = extraMeta.url;
      if (extraMeta.prompt) newMsg.prompt = extraMeta.prompt;
      if (extraMeta.width) newMsg.width = extraMeta.width;
      if (extraMeta.height) newMsg.height = extraMeta.height;
      if (extraMeta.seed) newMsg.seed = extraMeta.seed;
    }

    msgs.push(newMsg);
    sessData.updatedAt = new Date().toISOString();
    const tempFile = sessFile + `.tmp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    try {
      await fsp.writeFile(tempFile, JSON.stringify(sessData, null, 2), 'utf8');
      safeAtomicRenameSync(tempFile, sessFile);
    } catch (err) {
      try { fs.unlinkSync(tempFile); } catch {}
      throw err;
    }
    return true;
}

// Helper jeda asinkronus untuk mencegah lonjakan rate-limit (RPM)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper untuk memanggil LLM (OpenRouter atau Ollama) dari backend dengan dukungan riwayat pesan & auto-detect provider per model
async function callLLMBackend({ prompt, system, messages, model, provider, endpoint, apiKey, openRouterKey, ollamaApiKey }) {
  let finalMessages = [];

  if (Array.isArray(messages) && messages.length > 0) {
    if (system && system.trim()) {
      finalMessages.push({ role: 'system', content: system.trim() });
    }
    messages.forEach(m => {
      if (m.role !== 'system') {
        finalMessages.push({
          role: m.role || 'user',
          content: typeof m.content === 'string' ? m.content : ''
        });
      }
    });
    if (prompt && (!finalMessages.length || finalMessages[finalMessages.length - 1].content !== prompt)) {
      finalMessages.push({ role: 'user', content: prompt });
    }
  } else {
    if (system && system.trim()) finalMessages.push({ role: 'system', content: system.trim() });
    if (prompt && prompt.trim()) finalMessages.push({ role: 'user', content: prompt.trim() });
  }

  // Auto-enrich YouTube links in user turns with real-time oEmbed metadata
  try {
    for (let i = finalMessages.length - 1; i >= 0; i--) {
      const msg = finalMessages[i];
      if (msg.role === 'user' && typeof msg.content === 'string' && extractYouTubeVideoIds(msg.content).length > 0) {
        const enriched = await enrichTextWithYouTubeContext(msg.content);
        if (enriched.youtubeVideos && enriched.youtubeVideos.length > 0) {
          msg.content = enriched.text;
          break;
        }
      }
    }
  } catch (ytErr) {
    console.warn('YouTube auto-enrichment warning in callLLMBackend:', ytErr.message);
  }

  // Auto-enrich Web Page links in user turns with real-time extracted content
  try {
    for (let i = finalMessages.length - 1; i >= 0; i--) {
      const msg = finalMessages[i];
      if (msg.role === 'user' && typeof msg.content === 'string' && extractWebUrls(msg.content).length > 0) {
        const enrichedWeb = await enrichTextWithWebPageContext(msg.content);
        if (enrichedWeb.webPages && enrichedWeb.webPages.length > 0) {
          msg.content = enrichedWeb.text;
          break;
        }
      }
    }
  } catch (webErr) {
    console.warn('Web page auto-enrichment warning in callLLMBackend:', webErr.message);
  }

  const rawModel = (model || '').trim();
  // Auto-detect Provider per Model secara cerdas
  let effectiveProvider = provider || 'ollama';
  if (rawModel.includes('/')) {
    // Model dengan namespace vendor (contoh: deepseek/..., google/..., anthropic/...) adalah OpenRouter
    effectiveProvider = 'openrouter';
  } else if (rawModel.includes(':') || rawModel.startsWith('nemotron') || rawModel.startsWith('gemma') || rawModel.startsWith('llama') || rawModel.startsWith('qwen') || rawModel.startsWith('mistral') || rawModel.startsWith('phi')) {
    // Model dengan tag versi atau nama model lokal khas Ollama
    effectiveProvider = 'ollama';
  }

  const isOpenRouter = effectiveProvider === 'openrouter' || (rawModel.includes('/') && effectiveProvider !== 'ollama');

  // Normalisasi role "system" jika model tidak mendukungnya (misal: Gemma, Liquid LFM, Inkling, Dots, Ling, Apodex)
  const rawModelLower = (rawModel || '').toLowerCase();
  const doesSupportSystem = !(
    rawModelLower.includes('gemma') ||
    rawModelLower.includes('mistral-tiny') ||
    rawModelLower.includes('lfm') ||
    rawModelLower.includes('liquid') ||
    rawModelLower.includes('inkling') ||
    rawModelLower.includes('dots-') ||
    rawModelLower.includes('ling-') ||
    rawModelLower.includes('apodex')
  );
  if (!doesSupportSystem) {
    const sysIdx = finalMessages.findIndex(m => m.role === 'system');
    if (sysIdx !== -1) {
      const sysMsg = finalMessages.splice(sysIdx, 1)[0];
      const firstUser = finalMessages.find(m => m.role === 'user');
      if (firstUser) {
        firstUser.content = `[Instruksi Sistem & Konteks:\n${sysMsg.content}]\n\n${firstUser.content}`;
      } else {
        finalMessages.unshift({ role: 'user', content: `[Instruksi Sistem & Konteks:\n${sysMsg.content}]` });
      }
    }
  }

  if (isOpenRouter) {
    const key = openRouterKey || (apiKey && apiKey.startsWith('sk-or-') ? apiKey : null) || process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OpenRouter API Key diperlukan untuk model cloud: ' + (rawModel || 'default'));

    const isFreeModel = (rawModel || '').includes(':free') || (rawModel || '').endsWith('/free') || rawModel === 'openrouter/free';
    const candidateModels = isFreeModel
      ? [
          rawModel,
          'nvidia/nemotron-3.5-lightning:free',
          'nvidia/nemotron-3-super-120b-a12b:free',
          'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
          'cohere/north-mini-code:free',
          'openrouter/free'
        ].filter(Boolean).filter((m, idx, arr) => arr.indexOf(m) === idx)
      : [rawModel || 'nvidia/nemotron-3.5-lightning:free'];

    const tryCallOpenRouter = (targetModel) => {
      // Pastikan pesan disesuaikan dengan kapabilitas system role model target
      const targetLower = (targetModel || '').toLowerCase();
      let targetMessages = JSON.parse(JSON.stringify(finalMessages));
      const targetNoSystem = (
        targetLower.includes('gemma') ||
        targetLower.includes('mistral-tiny') ||
        targetLower.includes('lfm') ||
        targetLower.includes('liquid') ||
        targetLower.includes('inkling') ||
        targetLower.includes('dots-') ||
        targetLower.includes('ling-') ||
        targetLower.includes('apodex')
      );
      if (targetNoSystem) {
        const sIdx = targetMessages.findIndex(m => m.role === 'system');
        if (sIdx !== -1) {
          const sMsg = targetMessages.splice(sIdx, 1)[0];
          const fUser = targetMessages.find(m => m.role === 'user');
          if (fUser) {
            fUser.content = `[Instruksi Sistem & Konteks:\n${sMsg.content}]\n\n${fUser.content}`;
          } else {
            targetMessages.unshift({ role: 'user', content: `[Instruksi Sistem & Konteks:\n${sMsg.content}]` });
          }
        }
      }

      const payload = {
        model: targetModel,
        messages: targetMessages,
        temperature: 0.3,
        provider: {
          allow_fallbacks: true
        }
      };

      const postData = JSON.stringify(payload);

      return new Promise((resolve, reject) => {
        let settled = false;
        const safeResolve = (data) => {
          if (!settled) {
            settled = true;
            resolve(data);
          }
        };
        const safeReject = (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        };

        const options = {
          hostname: 'openrouter.ai',
          port: 443,
          path: '/api/v1/chat/completions',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/Zozi0999/zoz_router',
            'X-Title': 'Zoz Router Deep Research',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 60000
        };

        const req = https.request(options, (res) => {
          let rawData = '';
          res.on('data', chunk => rawData += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(rawData);
              if (res.statusCode >= 400 || parsed.error) {
                const errMsg = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : (parsed.error || `HTTP ${res.statusCode}: Permintaan OpenRouter gagal`);
                return safeReject(new Error(`OpenRouter Error [${res.statusCode}]: ${errMsg}`));
              }
              const content = parsed.choices?.[0]?.message?.content || '';
              if (!content.trim()) {
                return safeReject(new Error(`OpenRouter tidak mengembalikan konten respons untuk model: ${targetModel}`));
              }
              safeResolve(content);
            } catch (e) {
              safeReject(new Error('Gagal memproses respon OpenRouter: ' + e.message));
            }
          });
          res.on('error', err => safeReject(err));
        });
        req.on('timeout', () => { req.destroy(); safeReject(new Error('OpenRouter request timed out')); });
        req.on('error', err => safeReject(err));
        req.write(postData);
        req.end();
      });
    };

    let lastError = null;
    for (let i = 0; i < candidateModels.length; i++) {
      const candidate = candidateModels[i];
      try {
        const res = await tryCallOpenRouter(candidate);
        return res;
      } catch (err) {
        lastError = err;
        if (candidateModels.length > 1 && i < candidateModels.length - 1) {
          console.warn(`[OpenRouter Backend Free Failover] Model ${candidate} gagal: ${err.message}. Mencoba ${candidateModels[i + 1]}...`);
          // Berikan jeda adaptif (backoff) jika rate-limited (HTTP 429) sebelum mencoba model berikutnya
          const is429 = err.message && (err.message.includes('429') || err.message.toLowerCase().includes('rate limit'));
          await sleep(is429 ? 2000 : 600);
          continue;
        }
      }
    }
    throw lastError || new Error(`Gagal memanggil model OpenRouter: ${rawModel}`);
  }

  // Fallback / Default: Ollama Engine
  // H6: env OLLAMA_API_KEY hanya dipakai bila endpoint tidak dispesifikasi klien,
  // localhost, atau ollama.com — endpoint khusus klien tak pernah menerima secret.
  const ollamaEpTrim = (endpoint || '').trim();
  const ollamaEpIsCustom = Boolean(ollamaEpTrim) && !isTrustedOllamaEndpoint(
    /^https?:\/\//i.test(ollamaEpTrim) ? ollamaEpTrim : 'http://' + ollamaEpTrim
  );
  const activeOllamaKey = ollamaApiKey || (apiKey && !apiKey.startsWith('sk-or-') ? apiKey : null) ||
    (ollamaEpIsCustom ? null : process.env.OLLAMA_API_KEY);
  let rawEp = (endpoint || '').trim();

  // 100% Pure Cloud Architecture: Jika tidak ada custom endpoint Ollama eksternal dengan API key valid,
  // alihkan secara transparan ke OpenRouter Cloud AI menggunakan model mapping resmi.
  const hasCustomOllama = Boolean(activeOllamaKey && rawEp && !rawEp.includes('127.0.0.1') && !rawEp.includes('localhost') && !rawEp.includes('ollama.com'));
  const hasOpenRouterKey = Boolean(openRouterKey || (apiKey && apiKey.startsWith('sk-or-')) || process.env.OPENROUTER_API_KEY);
  if (!isOpenRouter && !hasCustomOllama && hasOpenRouterKey) {
    try {
      const mappedModel = mapOllamaModelToOpenRouter(rawModel);
      return await callLLMBackend({
        prompt,
        system,
        messages,
        model: mappedModel,
        provider: 'openrouter',
        endpoint,
        apiKey: openRouterKey || apiKey,
        openRouterKey: openRouterKey || (apiKey && apiKey.startsWith('sk-or-') ? apiKey : null) || process.env.OPENROUTER_API_KEY
      });
    } catch (bridgeErr) {
      console.warn('[callLLMBackend] OpenRouter pure cloud bridge gagal, fallback ke Ollama:', bridgeErr.message);
    }
  }

  // Jika activeOllamaKey ada dan endpoint tidak dispesifikasi, gunakan Ollama Cloud
  if (activeOllamaKey && (!rawEp || rawEp.includes('127.0.0.1') || rawEp.includes('localhost'))) {
    rawEp = 'https://ollama.com';
  } else if (!rawEp) {
    rawEp = 'http://127.0.0.1:11434';
  }

  if (!/^https?:\/\//i.test(rawEp)) {
    rawEp = (rawEp.includes(':443') || rawEp.includes('ollama.com') || rawEp.includes('.com') || rawEp.includes('.io') || rawEp.includes('.ai') || rawEp.includes('.app')) 
      ? `https://${rawEp}` 
      : `http://${rawEp}`;
  }
  rawEp = rawEp.replace(/\/+$/, '');

  if (isOllamaEndpointForbidden(rawEp)) {
    throw new Error('Endpoint Ollama mengarah ke host privat/internal - akses diblokir (SSRF Protection).');
  }
  // M23: endpoint non-tepercaya yang me-resolve ke IP privat (DNS-rebinding) ditolak.
  if (!isTrustedOllamaEndpoint(rawEp)) {
    const dnsVerdict = await assertResolvesPublic(rawEp);
    if (!dnsVerdict.ok) throw new Error(dnsVerdict.msg);
  }

  const ollamaUrl = resolveEndpointUrl(rawEp, 'api/chat');
  const client = ollamaUrl.protocol === 'https:' ? https : http;

  const isCloudOllama = rawEp.includes('ollama.com');
  const postData = JSON.stringify({
    model: rawModel || (isCloudOllama ? 'gemma4:31b' : 'qwen2.5:1.5b'),
    messages: finalMessages,
    stream: false,
    options: { temperature: 0.3 }
  });

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'ZozRouter/1.0',
    'Content-Length': Buffer.byteLength(postData)
  };
  if (activeOllamaKey) {
    headers['Authorization'] = `Bearer ${activeOllamaKey}`;
    headers['x-ollama-key'] = activeOllamaKey;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const safeResolve = (data) => {
      if (!settled) {
        settled = true;
        resolve(data);
      }
    };
    const safeReject = (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    const req = client.request(ollamaUrl.toString(), {
      method: 'POST',
      headers,
      timeout: 90000
    }, (res) => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          if (res.statusCode >= 400 || parsed.error) {
            const errMsg = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : (parsed.error || `HTTP ${res.statusCode}: Permintaan Ollama gagal`);
            return safeReject(new Error(`Ollama Error [${res.statusCode}]: ${errMsg}`));
          }
          const content = parsed.message?.content || parsed.response || '';
          if (!content.trim()) {
            return safeReject(new Error(`Ollama tidak mengembalikan respons teks untuk model: ${rawModel || 'default'}`));
          }
          safeResolve(content);
        } catch (e) {
          safeReject(new Error('Gagal memproses respon Ollama: ' + e.message));
        }
      });
      res.on('error', err => safeReject(err));
    });
    req.on('timeout', () => { req.destroy(); safeReject(new Error('Ollama request timed out')); });
    req.on('error', err => safeReject(err));
    req.write(postData);
    req.end();
  });
}


// Helper untuk melakukan web scraping / pemindaian konten artikel mendalam dari URL dengan proteksi redirect loop & SSRF
function fetchPageDetails(targetUrl, maxChars = 8000, redirectCount = 0) {
  let cleanTarget = String(targetUrl || '').trim();
  if (cleanTarget && !/^https?:\/\//i.test(cleanTarget)) {
    cleanTarget = 'https://' + cleanTarget;
  }
  // M23: guard DNS anti-rebinding (juga diulang untuk tiap hop redirect rekursif).
  return assertResolvesPublic(cleanTarget).then((verdict) => {
    if (!verdict.ok) return { success: false, error: verdict.msg };
    return new Promise((resolve) => {
    try {
      if (redirectCount > 3) {
        return resolve({ success: false, error: 'Batas maksimal 3 hop redirect tercapai.' });
      }
      if (!cleanTarget || !/^https?:\/\//i.test(cleanTarget)) {
        return resolve({ success: false, error: 'URL target tidak valid.' });
      }
      const parsedUrl = new URL(cleanTarget);
      if (isPrivateHost(parsedUrl.hostname, parsedUrl.port)) {
        return resolve({ success: false, error: 'Akses ke host lokal / intranet diblokir (SSRF Protection).' });
      }
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br'
        },
        timeout: 9000
      };

      let rawHtml = '';
      let resolved = false;

      function finishExtract(html) {
        if (resolved) return;
        resolved = true;
        try {
          const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
          let pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
          pageTitle = pageTitle
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

          let clean = html
            .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
            .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
            .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
            .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
            .replace(/<aside\b[\s\S]*?<\/aside>/gi, ' ')
            .replace(/<form\b[\s\S]*?<\/form>/gi, ' ')
            .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
            .replace(/<!--[\s\S]*?-->/g, ' ');

          clean = cleanHtmlText(clean);


          resolve({
            success: true,
            url: cleanTarget,
            domain: parsedUrl.hostname,
            title: pageTitle || parsedUrl.hostname,
            charCount: Math.min(clean.length, maxChars),
            content: clean.substring(0, maxChars)
          });
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      }

      const req = client.request(options, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          try {
            res.resume();
            resolved = true;
            const redirectUrl = new URL(res.headers.location, cleanTarget).toString();
            return fetchPageDetails(redirectUrl, maxChars, redirectCount + 1).then(resolve);
          } catch (e) {
            resolved = true;
            return resolve({ success: false, error: 'Redirect error: ' + e.message });
          }
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          resolved = true;
          if (redirectCount === 0) {
            return fallbackJinaReader(cleanTarget, maxChars).then(jinaRes => {
              if (jinaRes && jinaRes.text && jinaRes.text.length > 30) {
                return resolve({
                  success: true,
                  url: cleanTarget,
                  domain: parsedUrl.hostname,
                  title: jinaRes.title || parsedUrl.hostname,
                  charCount: Math.min(jinaRes.text.length, maxChars),
                  content: jinaRes.text.substring(0, maxChars)
                });
              }
              return resolve({ success: false, error: `HTTP ${res.statusCode}` });
            }).catch(() => resolve({ success: false, error: `HTTP ${res.statusCode}` }));
          }
          return resolve({ success: false, error: `HTTP ${res.statusCode}` });
        }

        // Dekompresi stream jika server web mengembalikan format gzip, deflate, atau brotli
        const enc = (res.headers['content-encoding'] || '').toLowerCase();
        let stream = res;
        try {
          if (enc === 'gzip') {
            stream = res.pipe(zlib.createGunzip());
          } else if (enc === 'deflate') {
            stream = res.pipe(zlib.createInflate());
          } else if (enc === 'br') {
            stream = res.pipe(zlib.createBrotliDecompress());
          }
        } catch (_) {
          stream = res;
        }

        let chunks = [];
        let totalLen = 0;
        stream.on('data', chunk => {
          chunks.push(chunk);
          totalLen += chunk.length;
          if (totalLen >= 300000 && !resolved) {
            req.destroy();
            rawHtml = Buffer.concat(chunks).toString('utf8');
            finishExtract(rawHtml);
          }
        });

        stream.on('end', () => {
          if (!resolved) {
            rawHtml = typeof chunks !== 'undefined' && chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : rawHtml;
            finishExtract(rawHtml);
          }
        });
        stream.on('error', () => {
          try { res.unpipe(); } catch (_) {}
          try { if (stream !== res) stream.destroy(); } catch (_) {}
          if (!resolved) {
            resolved = true;
            if (redirectCount === 0) {
              return fallbackJinaReader(targetUrl, maxChars).then(jinaRes => {
                if (jinaRes && jinaRes.text && jinaRes.text.length > 30) {
                  return resolve({
                    success: true,
                    url: targetUrl,
                    domain: parsedUrl.hostname,
                    title: jinaRes.title || parsedUrl.hostname,
                    charCount: Math.min(jinaRes.text.length, maxChars),
                    content: jinaRes.text.substring(0, maxChars)
                  });
                }
                return resolve({ success: false, error: 'Stream decompression error' });
              }).catch(() => resolve({ success: false, error: 'Stream decompression error' }));
            }
            resolve({ success: false, error: 'Stream decompression error' });
          }
        });
        res.on('error', () => {
          try { res.unpipe(); } catch (_) {}
          try { if (stream !== res) stream.destroy(); } catch (_) {}
          if (!resolved) {
            resolved = true;
            if (redirectCount === 0) {
              return fallbackJinaReader(targetUrl, maxChars).then(jinaRes => {
                if (jinaRes && jinaRes.text && jinaRes.text.length > 30) {
                  return resolve({
                    success: true,
                    url: targetUrl,
                    domain: parsedUrl.hostname,
                    title: jinaRes.title || parsedUrl.hostname,
                    charCount: Math.min(jinaRes.text.length, maxChars),
                    content: jinaRes.text.substring(0, maxChars)
                  });
                }
                return resolve({ success: false, error: 'Response error' });
              }).catch(() => resolve({ success: false, error: 'Response error' }));
            }
            resolve({ success: false, error: 'Response error' });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        if (!resolved) {
          resolved = true;
          if (redirectCount === 0) {
            return fallbackJinaReader(targetUrl, maxChars).then(jinaRes => {
              if (jinaRes && jinaRes.text && jinaRes.text.length > 30) {
                return resolve({
                  success: true,
                  url: targetUrl,
                  domain: parsedUrl.hostname,
                  title: jinaRes.title || parsedUrl.hostname,
                  charCount: Math.min(jinaRes.text.length, maxChars),
                  content: jinaRes.text.substring(0, maxChars)
                });
              }
              return resolve({ success: false, error: 'Network timeout (9s)' });
            }).catch(() => resolve({ success: false, error: 'Network timeout (9s)' }));
          }
          resolve({ success: false, error: 'Network timeout (9s)' });
        }
      });
      req.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          if (redirectCount === 0) {
            return fallbackJinaReader(targetUrl, maxChars).then(jinaRes => {
              if (jinaRes && jinaRes.text && jinaRes.text.length > 30) {
                return resolve({
                  success: true,
                  url: targetUrl,
                  domain: parsedUrl.hostname,
                  title: jinaRes.title || parsedUrl.hostname,
                  charCount: Math.min(jinaRes.text.length, maxChars),
                  content: jinaRes.text.substring(0, maxChars)
                });
              }
              return resolve({ success: false, error: err.message });
            }).catch(() => resolve({ success: false, error: err.message }));
          }
          resolve({ success: false, error: err.message });
        }
      });
      req.end();
    } catch (err) {
      if (redirectCount === 0) {
        return fallbackJinaReader(targetUrl, maxChars).then(jinaRes => {
          if (jinaRes && jinaRes.text && jinaRes.text.length > 30) {
            return resolve({
              success: true,
              url: targetUrl,
              domain: parsedUrl.hostname,
              title: jinaRes.title || parsedUrl.hostname,
              charCount: Math.min(jinaRes.text.length, maxChars),
              content: jinaRes.text.substring(0, maxChars)
            });
          }
          return resolve({ success: false, error: err.message });
        }).catch(() => resolve({ success: false, error: err.message }));
      }
      resolve({ success: false, error: err.message });
    }
    });
  });
}

// Pembersih tanda baca URL yang memperhitungkan keseimbangan tanda kurung (misal: artikel Wikipedia)
function cleanExtractedUrlPunctuation(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let clean = rawUrl.trim().replace(/^[<(\[]+/, '').replace(/[.,!?;:>\]]+$/, '');
  while (clean.endsWith(')')) {
    const openCount = (clean.match(/\(/g) || []).length;
    const closeCount = (clean.match(/\)/g) || []).length;
    if (closeCount > openCount) {
      clean = clean.slice(0, -1).replace(/[.,!?;:]+$/, '');
    } else {
      break;
    }
  }
  return clean;
}

// Ekstraktor URL web publik (mengecualikan YouTube karena sudah ada oEmbed khusus)
function extractWebUrls(text) {
  if (!text || typeof text !== 'string') return [];
  const urlRegex = /https?:\/\/[^\s<>"'{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map(u => cleanExtractedUrlPunctuation(u)).filter(u => {
    try {
      const p = new URL(u);
      const h = p.hostname.toLowerCase();
      if (h.includes('youtube.com') || h.includes('youtu.be')) return false;
      return true;
    } catch (_) {
      return false;
    }
  });
}

// Ekstraktor URL kustom komprehensif untuk Mode Deep Research (penganalisis web kustom URL)
function extractCustomAnalysisUrls(text) {
  if (!text || typeof text !== 'string') return [];
  const urlRegex = /(?:https?:\/\/[^\s<>"'{}|\\^`\[\]]+|www\.[^\s<>"'{}|\\^`\[\]]+)/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map(u => {
    let clean = cleanExtractedUrlPunctuation(u);
    if (/^www\./i.test(clean)) clean = 'https://' + clean;
    return clean;
  }).filter(u => {
    try {
      new URL(u);
      return true;
    } catch (_) {
      return false;
    }
  });
}

// Universal Web Page Grounding Enricher: injects real-time extracted article text for 100% of LLM models
async function enrichTextWithWebPageContext(text) {
  if (!text || typeof text !== 'string') return { text, webPages: [] };
  const urls = extractWebUrls(text);
  if (urls.length === 0) return { text, webPages: [] };

  const targetUrls = urls.slice(0, 3);
  const results = await Promise.all(targetUrls.map(url => fetchPageDetails(url, 6000)));
  const validPages = results.filter(r => r && r.success && r.content && r.content.length > 50);

  if (validPages.length === 0) return { text, webPages: [] };

  const contextBlocks = validPages.map((p, idx) => {
    return `[KONTEN TERVERIFIKASI SITUS WEB #${idx + 1}]
- Sumber URL: ${p.url}
- Judul Halaman: "${p.title}"
- Domain: ${p.domain}
- Panjang Teks: ${p.charCount} karakter
--- ISI TEKS BERSIH HALAMAN ---
${p.content}
--- AKHIR ISI SITUS WEB #${idx + 1} ---`;
  }).join('\n\n');

  const groundingPrompt = `\n\n### DATA KONTEN WEB HASIL EKSTRAKSI REAL-TIME:\n${contextBlocks}\n\nInstruksi untuk AI: Gunakan dokumen teks situs web resmi yang berhasil diekstrak di atas untuk menjawab, merangkum, menganalisis, dan menjelaskan isi halaman web tersebut kepada pengguna secara akurat, mendalam, dan bebas halusinasi.`;

  return {
    text: text + groundingPrompt,
    webPages: validPages,
    groundingContext: groundingPrompt
  };
}

// ==================== AUTONOMOUS MULTI-SOURCE WEB EXPLORER ENGINES ====================
// Engine pencarian multi-sumber: Google Serper, Google News RSS, Tech Wire / HackerNews, & DuckDuckGo Instant

function stripDateNoise(q) {
  if (!q || typeof q !== 'string') return '';
  const months = 'januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|april|may|june|july|august|september|october|november|december';
  const days = 'senin|selasa|rabu|kamis|jumat|sabtu|minggu|monday|tuesday|wednesday|thursday|friday|saturday|sunday';
  return q
    .replace(new RegExp(`\\b(${days})\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\b\\d{1,2}\\s+(${months})(?:\\s*,?\\s*\\d{2,4})?\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\b(${months})\\s+\\d{1,2}(?:\\s*,?\\s*\\d{2,4})?\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\b(${months})(?:\\s+\\d{2,4})?\\b`, 'gi'), ' ')
    .replace(/\b(202[0-9])\b/g, ' ')
    .replace(/[,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveBroadSearchQueries(rawQuery, contextText = '') {
  if (!rawQuery || typeof rawQuery !== 'string') {
    return { primary: '', tech: '', news: '', recentNews: '', recentNewsId: '', weeklyNews: '', core: '' };
  }

  // Bersihkan karakter berlebih / HTML
  let cleanQuery = rawQuery
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\p{L}\p{N}\s\.\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Bersihkan kata pengisi percakapan umum tanpa merusak topik inti
  const fillerWords = [
    'tolong', 'carikan', 'cari', 'bantu', 'apakah', 'bisakah', 'coba',
    'search', 'find', 'please'
  ];
  let coreQuery = cleanQuery;
  fillerWords.forEach(w => {
    coreQuery = coreQuery.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
  });
  coreQuery = coreQuery.replace(/\s+/g, ' ').trim();
  if (coreQuery.length < 2) coreQuery = cleanQuery;

  const isDomestic = isExplicitDomesticIndoQuery(cleanQuery) || isExplicitDomesticIndoQuery(contextText);

    const hasNewsWord = /\b(news|berita)\b/i.test(coreQuery);
    const hasLatestWord = /\b(latest|terbaru|terkini)\b/i.test(coreQuery);
    const newsSuffix = hasNewsWord ? '' : ' news';
    const latestSuffix = hasLatestWord ? '' : ' latest';

    return {
      primary: cleanQuery,
      core: coreQuery,
      news: `${coreQuery}${newsSuffix}`.replace(/\s+/g, ' ').trim(),
      recentNews: isDomestic ? `${coreQuery} berita terbaru` : `${coreQuery}${latestSuffix}${newsSuffix}`.replace(/\s+/g, ' ').trim(),
      recentNewsId: isDomestic ? `${coreQuery} berita terkini` : `${coreQuery} breaking news`,
      weeklyNews: `${coreQuery} updates`,
      tech: coreQuery.replace(/\b(major|news|headlines|breaking)\b/gi, ' ').replace(/\s+/g, ' ').trim() || coreQuery
    };
}

function cleanHtmlText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;|&#8230;/g, '...')
    .replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&ldquo;|&#8220;/g, "“")
    .replace(/&rdquo;|&#8221;/g, "”")
    .replace(/\s+/g, ' ')
    .trim();
}

function fetchGoogleNewsRss(query, lang = 'en', maxCount = 8) {
  return new Promise((resolve) => {
    try {
      const hl = lang === 'id' ? 'id' : 'en-US';
      const gl = lang === 'id' ? 'ID' : 'US';
      const ceid = lang === 'id' ? 'ID:id' : 'US:en';
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

      const req = https.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
        timeout: 6000
      }, (res) => {
        let xml = '';
        res.on('data', c => {
          xml += c;
          if (xml.length > 500000) req.destroy();
        });
        res.on('end', () => {
          const results = [];
          const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
          let match;
          while ((match = itemRegex.exec(xml)) !== null && results.length < maxCount) {
            const itemXml = match[1];
            const titleMatch = /<title>(.*?)<\/title>/i.exec(itemXml);
            const linkMatch = /<link>(.*?)<\/link>/i.exec(itemXml);
            const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/i.exec(itemXml);
            const sourceMatch = /<source[^>]*url="([^"]*)"[^>]*>(.*?)<\/source>/i.exec(itemXml);

            if (titleMatch && linkMatch) {
              const rawTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
              let title = cleanHtmlText(rawTitle);
              let rawUrl = linkMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
              const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';
              const timestamp = Date.parse(pubDate) || 0;
              let sourceName = sourceMatch ? cleanHtmlText(sourceMatch[2].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')) : '';

              // Ekstrak nama penerbit jika judul mengandung " - Publisher"
              const titleParts = title.split(' - ');
              if (titleParts.length > 1 && !sourceName) {
                sourceName = titleParts.pop().trim();
                title = titleParts.join(' - ');
              }

              let domain = sourceMatch && sourceMatch[1] ? extractDomainSafe(sourceMatch[1]) : '';
              if (!domain || domain === 'web') {
                domain = sourceName ? sourceName.toLowerCase().replace(/[\s\.\:\/]+/g, '') + '.com' : 'news.google.com';
              }

              results.push({
                title,
                url: rawUrl,
                domain,
                snippet: `[${sourceName || 'Berita'} | ${pubDate || 'Terkini'}] ${title}`,
                sourceProvider: sourceName ? `Google News (${sourceName})` : 'Google News',
                timestamp,
                pubDate
              });
            }
          }
          resolve(results);
        });
        res.on('error', () => resolve([]));
      });
      req.on('timeout', () => { req.destroy(); resolve([]); });
      req.on('error', () => resolve([]));
    } catch (_) { resolve([]); }
  });
}

function fetchHackerNewsTech(query, maxCount = 8) {
  return new Promise((resolve) => {
    try {
      const minTimestamp = Math.floor((Date.now() - 120 * 86400 * 1000) / 1000);
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=12&numericFilters=created_at_i%3E${minTimestamp}`;
      const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 5000 }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            const results = [];
            if (Array.isArray(data.hits)) {
              for (const h of data.hits) {
                if (results.length >= maxCount) break;
                const title = cleanHtmlText(h.title);
                const targetUrl = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
                const timestamp = h.created_at_i ? h.created_at_i * 1000 : (Date.parse(h.created_at) || 0);
                const dateLabel = h.created_at ? new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Terkini';
                if (title && targetUrl) {
                  results.push({
                    title,
                    url: targetUrl,
                    domain: extractDomainSafe(targetUrl),
                    snippet: `[Tech Wire | ${dateLabel} | Skor: ${h.points || 0} | Komentar: ${h.num_comments || 0}] ${title}`,
                    sourceProvider: 'Tech Wire / HackerNews',
                    timestamp,
                    pubDate: h.created_at || ''
                  });
                }
              }
            }
            resolve(results);
          } catch (_) { resolve([]); }
        });
        res.on('error', () => resolve([]));
      });
      req.on('timeout', () => { req.destroy(); resolve([]); });
      req.on('error', () => resolve([]));
    } catch (_) { resolve([]); }
  });
}

function fetchWikipediaFullText(query, lang = 'en', maxCount = 4) {
  return new Promise((resolve) => {
    try {
      const wikiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&origin=*`;
      const req = https.get(wikiUrl, { headers: { 'User-Agent': 'ZozRouter/2.0 (AI Multi-Engine Gateway)' }, timeout: 5000 }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            const items = data.query?.search || [];
            const results = [];
            for (const item of items.slice(0, maxCount)) {
              const cleanSnip = cleanHtmlText(item.snippet);
              const pTitle = item.title;
              const pUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pTitle.replace(/ /g, '_'))}`;
              results.push({
                title: pTitle,
                url: pUrl,
                domain: `${lang}.wikipedia.org`,
                snippet: cleanSnip || `Artikel ensiklopedia: ${pTitle}`,
                sourceProvider: lang === 'en' ? 'Wikipedia Global' : 'Wikipedia Indonesia'
              });
            }
            resolve(results);
          } catch (_) { resolve([]); }
        });
        res.on('error', () => resolve([]));
      });
      req.on('timeout', () => { req.destroy(); resolve([]); });
      req.on('error', () => resolve([]));
    } catch (_) { resolve([]); }
  });
}

function fetchDuckDuckGoInstant(query) {
  return new Promise((resolve) => {
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const req = https.get(ddgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            const results = [];
            if (data.Heading && data.AbstractURL && !data.AbstractURL.includes('wikipedia.org')) {
              results.push({
                title: data.Heading,
                url: data.AbstractURL,
                domain: extractDomainSafe(data.AbstractURL),
                snippet: cleanHtmlText(data.Abstract || data.Heading),
                sourceProvider: 'DuckDuckGo Instant'
              });
            }
            if (Array.isArray(data.RelatedTopics)) {
              for (const rt of data.RelatedTopics.slice(0, 3)) {
                if (rt.FirstURL && rt.Text && !rt.FirstURL.includes('wikipedia.org')) {
                  results.push({
                    title: cleanHtmlText(rt.Text.slice(0, 60)),
                    url: rt.FirstURL,
                    domain: extractDomainSafe(rt.FirstURL),
                    snippet: cleanHtmlText(rt.Text),
                    sourceProvider: 'DuckDuckGo Related'
                  });
                }
              }
            }
            resolve(results);
          } catch (_) { resolve([]); }
        });
        res.on('error', () => resolve([]));
      });
      req.on('timeout', () => { req.destroy(); resolve([]); });
      req.on('error', () => resolve([]));
    } catch (_) { resolve([]); }
  });
}

async function performAutonomousSearch(query, maxResults = 15, contextText = '') {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return { query: '', count: 0, results: [] };
  }
  const cleanDateQuery = stripDateNoise(query.trim());
  const isDomestic = isExplicitDomesticIndoQuery(query.trim()) || isExplicitDomesticIndoQuery(contextText);
  const englishQuery = translateIndoQueryToGlobalEnglish(query.trim());
  const targetPrimaryQuery = (!isDomestic && englishQuery) ? englishQuery : query.trim();

  const qPlan = deriveBroadSearchQueries(targetPrimaryQuery, contextText);
  const cleanQuery = qPlan.primary;
  const techQuery = qPlan.tech;
  const newsQuery = qPlan.news;
  const recentQuery = qPlan.recentNews;
  const recentQueryId = qPlan.recentNewsId;
  const weeklyQuery = qPlan.weeklyNews;
  const coreQuery = qPlan.core;

  const serperCalls = [
    performWebSearch(cleanQuery, null, maxResults)
  ];
  if (!isDomestic && cleanQuery.toLowerCase() !== query.trim().toLowerCase()) {
    serperCalls.push(performWebSearch(query.trim(), null, maxResults));
  } else if (cleanDateQuery && cleanDateQuery.length >= 3 && cleanDateQuery.toLowerCase() !== cleanQuery.toLowerCase()) {
    serperCalls.push(performWebSearch(cleanDateQuery, null, maxResults));
  }

  const combinedLower = (cleanQuery + ' ' + query.trim() + ' ' + (contextText || '')).toLowerCase();
  const isTechQuery = /\b(ai|llm|software|github|code|linux|python|developer|api|tech|crypto|bitcoin|model|chip|gpu|nvidia|programming|framework)\b/i.test(combinedLower);

  // Eksekusi seluruh provider: Google Serper Global, Google News RSS Global (US/EN), Tech Wire / HackerNews, DuckDuckGo Instant, & Wikipedia Global (EN)
  const [serperRes1, serperRes2, gnewsPrimary, gnewsCore, gnewsIndo, gnewsNews, hnTech, hnCore, ddgInstant, wikiRes] = await Promise.allSettled([
    serperCalls[0],
    serperCalls[1] || Promise.resolve({ results: [] }),
    fetchGoogleNewsRss(cleanQuery, 'en', 10),
    fetchGoogleNewsRss(coreQuery, 'en', 8),
    isDomestic ? fetchGoogleNewsRss(`${coreQuery} berita terbaru`, 'id', 6) : Promise.resolve([]),
    fetchGoogleNewsRss(newsQuery, 'en', 6),
    isTechQuery ? fetchHackerNewsTech(techQuery, 8) : Promise.resolve([]),
    isTechQuery ? fetchHackerNewsTech(coreQuery, 6) : Promise.resolve([]),
    fetchDuckDuckGoInstant(coreQuery),
    fetchWikipediaFullText(coreQuery, isDomestic ? 'id' : 'en', 4)
  ]);

  const candidatePool = [];
  if (serperRes1.status === 'fulfilled' && Array.isArray(serperRes1.value?.results)) {
    candidatePool.push(...serperRes1.value.results);
  }
  if (serperRes2.status === 'fulfilled' && Array.isArray(serperRes2.value?.results)) {
    candidatePool.push(...serperRes2.value.results);
  }
  if (gnewsPrimary.status === 'fulfilled' && Array.isArray(gnewsPrimary.value)) candidatePool.push(...gnewsPrimary.value);
  if (gnewsCore.status === 'fulfilled' && Array.isArray(gnewsCore.value)) candidatePool.push(...gnewsCore.value);
  if (gnewsIndo.status === 'fulfilled' && Array.isArray(gnewsIndo.value)) candidatePool.push(...gnewsIndo.value);
  if (gnewsNews.status === 'fulfilled' && Array.isArray(gnewsNews.value)) candidatePool.push(...gnewsNews.value);
  if (hnTech.status === 'fulfilled' && Array.isArray(hnTech.value)) candidatePool.push(...hnTech.value);
  if (hnCore.status === 'fulfilled' && Array.isArray(hnCore.value)) candidatePool.push(...hnCore.value);
  if (ddgInstant.status === 'fulfilled' && Array.isArray(ddgInstant.value)) candidatePool.push(...ddgInstant.value);
  // Tambahkan Wikipedia hanya jika candidatePool dari berita/serper masih sedikit (< 3)
  if (candidatePool.length < 3 && wikiRes.status === 'fulfilled' && Array.isArray(wikiRes.value)) {
    candidatePool.push(...wikiRes.value);
  }

  // Urutkan kandidat berdasarkan tanggal publikasi terbaru (Descending: yang paling baru di paling atas)
  candidatePool.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Deduplikasi ketat berdasarkan URL kanonikal
  const results = [];
  const seenUrls = new Set();

  for (const item of candidatePool) {
    if (!item.url || !item.title) continue;
    const normUrl = item.url.trim().toLowerCase().replace(/\/$/, '');
    const normTitle = item.title.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');

    // Filter domain spam, aggregator regional berita clickbait, dan bot finansial yang tidak relevan untuk kueri global
    if (!isDomestic) {
      const isSpamOrClickbait = /\b(pluang|riaugreen|inforiau|riaupos|tribunnews|detik|kompas|liputan6|suara|merdeka|sindonews|viva|inews|kumparan|jpnn|kapanlagi|idntimes)\b/i.test(normUrl) || /\b(pluang|riaugreen)\b/i.test(item.domain || '');
      if (isSpamOrClickbait) continue;
    }

    // Filter Wikipedia HANYA jika sudah ada cukup sumber web/berita non-Wikipedia (>= 3)
    if (normUrl.includes('wikipedia.org') || (item.domain && item.domain.includes('wikipedia.org')) || normTitle.includes('wikipedia')) {
      if (results.length >= 3) continue;
    }

    // Filter out irrelevant disambiguation or unrelated codenames
    if (normTitle.includes('listofapplecodenames') && !cleanQuery.toLowerCase().includes('apple')) continue;
    if (normTitle.includes('jalanbesar') && !cleanQuery.toLowerCase().includes('jalan')) continue;

    if (seenUrls.has(normUrl)) continue;
    seenUrls.add(normUrl);

    results.push(item);
    if (results.length >= maxResults) break;
  }

  results.sort((a, b) => {
    const aRep = REPUTABLE_TECH_DOMAINS.has(a.domain) ? 1 : 0;
    const bRep = REPUTABLE_TECH_DOMAINS.has(b.domain) ? 1 : 0;
    if (aRep !== bRep) return bRep - aRep;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  const returnPayload = {
    query: cleanQuery,
    engine: 'autonomous_multi_source',
    count: results.length,
    results
  };
  // Tanpa SERPER_API_KEY, sumber Serper otomatis dilewati (performWebSearch
  // mengembalikan error tanpa jaringan). Endpoint ini TETAP dilayani oleh News
  // RSS/DuckDuckGo/Wikipedia, jadi jangan di-503 — tapi kondisinya harus terlihat.
  if (!process.env.SERPER_API_KEY) {
    returnPayload.warning = 'SERPER_API_KEY belum dikonfigurasi di server. Set env SERPER_API_KEY atau masukkan key di Pengaturan.';
  }
  return returnPayload;
}

// Engine pembaca dan penjelajah halaman web mandiri (Deep Page Browser)
function browseWebPageContent(targetUrl, maxChars = 5000, redirectCount = 0) {
  // M23: guard DNS anti-rebinding (juga diulang untuk tiap hop redirect rekursif).
  return assertResolvesPublic(targetUrl).then((verdict) => {
    if (!verdict.ok) return { url: targetUrl, error: verdict.msg, text: '' };
    return new Promise((resolve) => {
    try {
      if (redirectCount > 3) return resolve({ url: targetUrl, error: 'Too many redirects', text: '' });
      if (!targetUrl || typeof targetUrl !== 'string') {
        return resolve({ url: targetUrl, error: 'Invalid URL format', text: '' });
      }
      let cleanTarget = targetUrl.trim();
      if (!/^https?:\/\//i.test(cleanTarget)) {
        cleanTarget = 'https://' + cleanTarget;
      }
      const parsedUrl = new URL(cleanTarget);
      if (isPrivateHost(parsedUrl.hostname, parsedUrl.port)) {
        return resolve({ url: cleanTarget, error: 'Access to private host restricted', text: '' });
      }

      // Intersep khusus untuk URL YouTube agar mengembalikan data judul & channel resmi via oEmbed
      if (YOUTUBE_ALLOWED_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
        return fetchYouTubeInfo(cleanTarget).then(ytInfo => {
          if (ytInfo && ytInfo.success) {
            return resolve({
              url: ytInfo.url || cleanTarget,
              title: ytInfo.title,
              text: `[INFORMASI TERVERIFIKASI VIDEO YOUTUBE]\n- Judul: "${ytInfo.title}"\n- Channel / Pembuat: "${ytInfo.channel}" (${ytInfo.channel_url || 'N/A'})\n- URL: ${ytInfo.url}\n- Thumbnail: ${ytInfo.thumbnail}\n(Diambil secara real-time via YouTube oEmbed)`,
              links: ytInfo.channel_url ? [{ title: ytInfo.channel, url: ytInfo.channel_url }] : [],
              videoIds: ytInfo.videoId ? [ytInfo.videoId] : []
            });
          }
          return fallbackJinaReader(cleanTarget, maxChars).then(resolve);
        }).catch(() => {
          return fallbackJinaReader(cleanTarget, maxChars).then(resolve);
        });
      }

      const client = parsedUrl.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br'
        },
        timeout: 10000
      };

      let resolved = false;
      let rawHtml = '';

      function finishParsing(html) {
        if (resolved) return;
        resolved = true;
        try {
          const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
          const title = titleMatch ? cleanHtmlText(titleMatch[1]) : '';

          // Ekstrak tautan referensi penting dalam halaman
          const links = [];
          const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
          let lm;
          while ((lm = linkRegex.exec(html)) !== null && links.length < 8) {
            let href = lm[1].trim();
            const text = cleanHtmlText(lm[2]);
            if (href.startsWith('/') && !href.startsWith('//')) {
              href = parsedUrl.origin + href;
            }
            if (href.startsWith('http') && text && text.length > 3 && text.length < 90 && !href.includes(parsedUrl.hostname + '/#')) {
              links.push({ title: text, url: href });
            }
          }

          let clean = html
            .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
            .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
            .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
            .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
            .replace(/<aside\b[\s\S]*?<\/aside>/gi, ' ')
            .replace(/<form\b[\s\S]*?<\/form>/gi, ' ')
            .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
            .replace(/<!--[\s\S]*?-->/g, ' ');

          clean = cleanHtmlText(clean);

          if (clean.length < 50 && redirectCount === 0) {
            return fallbackJinaReader(cleanTarget, maxChars).then(resolve);
          }

          resolve({
            url: cleanTarget,
            title: title || parsedUrl.hostname,
            text: clean.substring(0, maxChars),
            totalLength: clean.length,
            links
          });
        } catch (e) {
          if (redirectCount === 0) return fallbackJinaReader(cleanTarget, maxChars).then(resolve);
          resolve({ url: cleanTarget, error: e.message, text: '' });
        }
      }

      const req = client.request(options, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          try {
            res.resume();
            const redirectUrl = new URL(res.headers.location, cleanTarget).toString();
            resolved = true;
            return browseWebPageContent(redirectUrl, maxChars, redirectCount + 1).then(resolve);
          } catch (_) {
            resolved = true;
            return resolve({ url: cleanTarget, error: 'Invalid redirect target', text: '' });
          }
        }

        // Decompress stream if server sent gzip, deflate, or brotli
        const enc = (res.headers['content-encoding'] || '').toLowerCase();
        let stream = res;
        try {
          if (enc === 'gzip') {
            stream = res.pipe(zlib.createGunzip());
          } else if (enc === 'deflate') {
            stream = res.pipe(zlib.createInflate());
          } else if (enc === 'br') {
            stream = res.pipe(zlib.createBrotliDecompress());
          }
        } catch (_) {
          stream = res;
        }

        let chunks2 = [];
        let totalLen2 = 0;
        stream.on('data', chunk => {
          chunks2.push(chunk);
          totalLen2 += chunk.length;
          if (totalLen2 >= 600000 && !resolved) {
            req.destroy();
            rawHtml = Buffer.concat(chunks2).toString('utf8');
            finishParsing(rawHtml);
          }
        });

        stream.on('end', () => { if (!resolved) { rawHtml = typeof chunks2 !== 'undefined' && chunks2.length > 0 ? Buffer.concat(chunks2).toString('utf8') : rawHtml; finishParsing(rawHtml); } });
        stream.on('error', (err) => {
          try { res.unpipe(); } catch (_) {}
          try { if (stream !== res) stream.destroy(); } catch (_) {}
          if (typeof chunks2 !== 'undefined' && chunks2.length > 0) { rawHtml = Buffer.concat(chunks2).toString('utf8'); finishParsing(rawHtml); } else if (rawHtml.length > 0) { finishParsing(rawHtml); }
          else if (!resolved) { resolved = true; resolve({ url: cleanTarget, error: err.message, text: '' }); }
        });
        res.on('error', (err) => {
          try { res.unpipe(); } catch (_) {}
          try { if (stream !== res) stream.destroy(); } catch (_) {}
          if (typeof chunks2 !== 'undefined' && chunks2.length > 0) { rawHtml = Buffer.concat(chunks2).toString('utf8'); finishParsing(rawHtml); } else if (rawHtml.length > 0) { finishParsing(rawHtml); }
          else if (!resolved) { resolved = true; resolve({ url: cleanTarget, error: err.message, text: '' }); }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        if (typeof chunks2 !== 'undefined' && chunks2.length > 0) { rawHtml = Buffer.concat(chunks2).toString('utf8'); finishParsing(rawHtml); } else if (rawHtml.length > 0) { finishParsing(rawHtml); }
        else if (!resolved) { resolved = true; resolve({ url: cleanTarget, error: 'Connection timeout', text: '' }); }
      });
      req.on('error', (err) => {
        if (typeof chunks2 !== 'undefined' && chunks2.length > 0) { rawHtml = Buffer.concat(chunks2).toString('utf8'); finishParsing(rawHtml); } else if (rawHtml.length > 0) { finishParsing(rawHtml); }
        else if (!resolved) { resolved = true; resolve({ url: cleanTarget, error: err.message, text: '' }); }
      });
      req.end();
    } catch (err) {
      resolve({ url: targetUrl, error: err.message, text: '' });
    }
    });
  });
}

function fallbackJinaReader(targetUrl, maxChars = 5000) {
  return new Promise((resolve) => {
    let settled = false;
    const safeResolve = (data) => {
      if (!settled) {
        settled = true;
        resolve(data);
      }
    };

    try {
      const req = https.get(`https://r.jina.ai/${targetUrl}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }, (res) => {
        let md = '';
        res.on('data', c => md += c);
        res.on('end', () => {
          if (res.statusCode === 200 && md.length > 50) {
            const titleMatch = md.match(/^Title:\s*(.+)$/m) || md.match(/^#\s+(.+)$/m);
            const title = titleMatch ? cleanHtmlText(titleMatch[1].trim()) : extractDomainSafe(targetUrl);
            safeResolve({
              url: targetUrl,
              title,
              text: md.substring(0, maxChars),
              totalLength: md.length,
              links: []
            });
          } else {
            safeResolve({ url: targetUrl, error: 'Empty content', text: '' });
          }
        });
        res.on('error', () => safeResolve({ url: targetUrl, error: 'Jina error', text: '' }));
      });
      req.on('timeout', () => { req.destroy(); safeResolve({ url: targetUrl, error: 'Jina timeout', text: '' }); });
      req.on('error', () => safeResolve({ url: targetUrl, error: 'Jina request error', text: '' }));
    } catch (_) { safeResolve({ url: targetUrl, error: 'Jina exception', text: '' }); }
  });
}

// ==================== ENGINE MEMORI JANGKA PANJANG LOKAL (SQLITE FTS5) ====================
let zozMemoryDb = null;
let zozMemoryAvailable = false;

function initZozMemoryDb() {
  if (zozMemoryDb) return zozMemoryDb;
  try {
    const { DatabaseSync } = require('node:sqlite');
    if (!fs.existsSync(DATA_DIR)) {
      try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
    }
    const memoryDbPath = path.join(DATA_DIR, 'zoz_memory.db');
    const db = new DatabaseSync(memoryDbPath);
    // Inisialisasi tabel FTS5 virtual table dengan user_id unindexed untuk isolasi privasi
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memories USING fts5(
        user_id UNINDEXED,
        topic,
        content
      );
    `);
    zozMemoryDb = db;
    zozMemoryAvailable = true;
    return zozMemoryDb;
  } catch (err) {
    zozMemoryAvailable = false;
    return null;
  }
}

// Fallback in-memory jika SQLite belum terinisialisasi
const memoryFallbackStore = [];

function saveMemoryRecord(userId, topic, content) {
  const cleanUid = sanitizeUserId(userId);
  const cleanTopic = String(topic || '').trim();
  const cleanContent = String(content || '').trim();
  if (!cleanTopic || !cleanContent) {
    throw new Error('Parameter topic dan content tidak boleh kosong.');
  }

  const db = initZozMemoryDb();
  if (db && zozMemoryAvailable) {
    try {
      const checkStmt = db.prepare('SELECT rowid FROM memories WHERE user_id = ? AND topic = ? AND content = ? LIMIT 1');
      const existing = checkStmt.all(cleanUid, cleanTopic, cleanContent);
      if (!existing || existing.length === 0) {
        const stmt = db.prepare('INSERT INTO memories (user_id, topic, content) VALUES (?, ?, ?)');
        stmt.run(cleanUid, cleanTopic, cleanContent);
      }
      return { success: true, topic: cleanTopic, engine: 'sqlite-fts5' };
    } catch (e) {
      console.warn('[ZOZ Memory] Gagal simpan ke SQLite, menggunakan fallback:', e.message);
    }
  }

  const existingIdx = memoryFallbackStore.findIndex(m => m.user_id === cleanUid && m.topic === cleanTopic && m.content === cleanContent);
  if (existingIdx !== -1) {
    memoryFallbackStore[existingIdx].time = Date.now();
  } else {
    memoryFallbackStore.unshift({ user_id: cleanUid, topic: cleanTopic, content: cleanContent, time: Date.now() });
    if (memoryFallbackStore.length > 500) memoryFallbackStore.pop();
  }
  return { success: true, topic: cleanTopic, engine: 'memory-fallback' };
}

function cleanFts5Query(query) {
  if (!query || typeof query !== 'string') return '';
  const words = query.replace(/[^\p{L}\p{N}_]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 15);
  if (words.length === 0) return '';
  return words.map(w => `"${w}"*`).join(' OR ');
}

function searchMemoryRecords(userId, query, limit = 5) {
  const cleanUid = sanitizeUserId(userId);
  const cleanQ = String(query || '').trim();
  if (!cleanQ) {
    return { success: true, count: 0, results: [], text: 'Kata kunci pencarian memori kosong.' };
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 20);
  const db = initZozMemoryDb();

  if (db && zozMemoryAvailable) {
    try {
      const ftsQuery = cleanFts5Query(cleanQ);
      if (ftsQuery) {
        const stmt = db.prepare(`
          SELECT topic, content 
          FROM memories 
          WHERE memories MATCH ? AND (user_id = ? OR user_id = 'default') 
          ORDER BY rank 
          LIMIT ?
        `);
        const rows = stmt.all(ftsQuery, cleanUid, safeLimit);
        if (rows && rows.length > 0) {
          const results = rows.map(r => ({ topic: r.topic, content: r.content }));
          const text = results.map(r => `[${r.topic}] : ${r.content}`).join('\n\n');
          return { success: true, count: results.length, results, text, engine: 'sqlite-fts5' };
        }
      }
    } catch (e) {
      console.warn('[ZOZ Memory] FTS5 search error:', e.message);
    }
  }

  const terms = cleanQ.toLowerCase().replace(/[^\p{L}\p{N}_]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  const scored = [];
  for (const m of memoryFallbackStore) {
    if (m.user_id !== cleanUid && m.user_id !== 'default') continue;
    const topLower = String(m.topic || '').toLowerCase();
    const conLower = String(m.content || '').toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (topLower.includes(t)) score += 3;
      if (conLower.includes(t)) score += 1;
    }
    if (score > 0) scored.push({ m, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const matched = scored.map(item => item.m).slice(0, safeLimit);

  if (matched.length > 0) {
    const text = matched.map(r => `[${r.topic}] : ${r.content}`).join('\n\n');
    return { success: true, count: matched.length, results: matched, text, engine: 'memory-fallback' };
  }

  return {
    success: true,
    count: 0,
    results: [],
    text: `Tidak ada catatan memori yang relevan untuk kata kunci: "${cleanQ}".`,
    engine: zozMemoryAvailable ? 'sqlite-fts5' : 'memory-fallback'
  };
}

// ==================== ENGINE EKSEKUSI PYTHON SUBPROCESS (SANDBOX) ====================
const PYTHON_SANDBOX_DIR = path.join(os.tmpdir(), 'zoz_python_sandbox');
try {
  if (!fs.existsSync(PYTHON_SANDBOX_DIR)) {
    fs.mkdirSync(PYTHON_SANDBOX_DIR, { recursive: true });
  }
} catch (_) {}

function validatePythonCodeSafety(code) {
  if (!code || typeof code !== 'string') return { safe: false, reason: 'Kode kosong' };

  // 0. Normalisasi Unicode (NFKC) untuk mencegah bypass dengan karakter fullwidth/homoglyph (misal ｉｍｐｏｒｔ ｏｓ)
  const normalizedCode = code.normalize('NFKC');

  // 1. Bersihkan komentar (# ...) dan docstring agar tidak memicu false positive pada teks dokumentasi.
  // Gunakan token-aware single pass regex untuk string dan komentar agar string kutip tunggal/ganda yang memuat """ tidak membajak docstring span
  const strippedCode = normalizedCode.replace(
    /(?:#.*$|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/gm,
    (match) => (match.startsWith('#') || match.startsWith('"""') || match.startsWith("'''")) ? ' ' : match
  );

  const blockedModules = [
    'os', 'sys', 'shutil', 'subprocess', 'socket', 'pty', 'ctypes', 'winreg',
    'multiprocessing', 'urllib', 'http', 'requests', 'pathlib', 'importlib',
    'pickle', 'shelve', 'marshal', 'webbrowser', 'signal', 'tempfile',
    'nt', 'posix', '_winapi', '_posixsubprocess', 'builtins', 'io', 'codecs',
    'glob', 'asyncio', 'ssl', 'ftplib', 'smtplib', 'imaplib', 'poplib'
  ];
  const blockedPattern = blockedModules.join('|');

  // Pola A: import modul (misal: "import os", "import math, shutil", "import sys as s")
  const importRegex = new RegExp(`\\bimport\\s+[^\\n;]*\\b(?:${blockedPattern})\\b`, 'i');
  if (importRegex.test(strippedCode)) {
    return { safe: false, reason: 'Impor modul sistem/jaringan terlarang terdeteksi pada pernyataan `import`.' };
  }

  // Pola B: from modul import (misal: "from os import system", "from shutil.something import rmtree")
  const fromImportRegex = new RegExp(`\\bfrom\\s+(?:${blockedPattern})(?:\\.[\\w.]+)?\\s+import\\b`, 'i');
  if (fromImportRegex.test(strippedCode)) {
    return { safe: false, reason: 'Impor modul sistem/jaringan terlarang terdeteksi pada pernyataan `from ... import`.' };
  }

  // Pola C: Dynamic import / built-ins code execution & runtime reflection (langsung maupun indirect alias assignment)
  const dynamicExecRegex = /\b(?:__import__|importlib|eval|exec|compile|breakpoint|getattr|setattr|delattr|hasattr|globals|locals|vars|__getattribute__|load_module)\b/i;
  if (dynamicExecRegex.test(strippedCode)) {
    return { safe: false, reason: 'Fungsi eksekusi dinamis atau refleksi runtime (__import__, eval, exec, compile, breakpoint, getattr, globals, vars, load_module) diblokir.' };
  }

  // Pola D: Dunder reflection sandbox escape (__subclasses__, __builtins__, __globals__, __bases__, __base__, __loader__, __spec__, dll)
  const dunderReflectionRegex = /\b(?:__subclasses__|__builtins__|__globals__|__bases__|__base__|__mro__|__loader__|__spec__)\b/i;
  if (dunderReflectionRegex.test(strippedCode)) {
    return { safe: false, reason: 'Refleksi hierarki objek internal (__subclasses__, __builtins__, __globals__, __base__, __loader__, __spec__) diblokir.' };
  }

  // Pola E: Input interaktif yang memblokir proses
  const interactiveInputRegex = /\b(?:input|help)\s*\(/i;
  if (interactiveInputRegex.test(strippedCode)) {
    return { safe: false, reason: 'Fungsi input interaktif `input()` atau `help()` diblokir. Jalankan kode non-interaktif.' };
  }

  // Pola F: Akses sistem berkas via bare open (mencegah alias o = open tanpa memblokir method objek)
  const fileAccessRegex = /(?<!\.)\bopen\b/i;
  if (fileAccessRegex.test(strippedCode)) {
    return { safe: false, reason: 'Akses sistem berkas via `open()` diblokir. Gunakan struktur data dalam memori.' };
  }

  // Pola G: Perintah destruktif sistem berkas / OS
  const destructiveRegex = /\b(?:rmtree|format|shutdown|del\s+\/[fq])\b/i;
  if (destructiveRegex.test(strippedCode)) {
    return { safe: false, reason: 'Perintah destruktif sistem berkas/OS terdeteksi.' };
  }

  return { safe: true };
}

function executePythonSandbox(code, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!code || typeof code !== 'string' || !code.trim()) {
      return resolve({
        success: false,
        output: 'Error: Kode Python tidak boleh kosong.',
        executionTimeMs: 0
      });
    }

    const cleanCode = code.trim();
    // Safety guard untuk pencegahan eksekusi destruktif & kebocoran kredensial host
    const safetyCheck = validatePythonCodeSafety(cleanCode);
    if (!safetyCheck.safe) {
      return resolve({
        success: false,
        output: `Error Keamanan: ${safetyCheck.reason} Sandbox keamanan ZOZ Router membatasi eksekusi ke modul pemrosesan data murni (math, statistics, re, json, datetime, itertools, collections, dll).`,
        executionTimeMs: 0
      });
    }

    const startTime = Date.now();
    const pythonExec = process.env.PYTHON_EXEC || 'python';
    let stdoutData = '';
    let stderrData = '';
    let isFinished = false;

    try {
      if (!fs.existsSync(PYTHON_SANDBOX_DIR)) {
        fs.mkdirSync(PYTHON_SANDBOX_DIR, { recursive: true });
      }
    } catch (_) {}

    // Lingkungan terisolasi tanpa kunci API atau token sensitif server
    const safeEnv = {
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      PYTHONUNBUFFERED: '1',
      PATH: process.env.PATH || process.env.Path || '',
      Path: process.env.Path || process.env.PATH || '',
      SYSTEMROOT: process.env.SYSTEMROOT || 'C:\\Windows',
      WINDIR: process.env.WINDIR || 'C:\\Windows',
      TEMP: PYTHON_SANDBOX_DIR,
      TMP: PYTHON_SANDBOX_DIR,
      HOME: PYTHON_SANDBOX_DIR,
      USERPROFILE: PYTHON_SANDBOX_DIR
    };

    let proc;
    try {
      proc = spawn(pythonExec, ['-u', '-'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: PYTHON_SANDBOX_DIR,
        windowsHide: true,
        env: safeEnv
      });
    } catch (spawnErr) {
      return resolve({
        success: false,
        output: `Error: Gagal menjalankan interpreter Python (${spawnErr.message}). Pastikan Python terinstal di sistem.`,
        executionTimeMs: Date.now() - startTime
      });
    }

    if (proc.stdin) {
      proc.stdin.on('error', () => {});
      try {
        proc.stdin.write(cleanCode + '\n', 'utf-8');
        proc.stdin.end();
      } catch (_) {}
    }

    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        try {
          proc.kill();
        } catch (_) {
          try { proc.kill('SIGKILL'); } catch (_) {}
        }
        resolve({
          success: false,
          output: `Error: Waktu eksekusi melebihi batas (Timeout ${timeoutMs / 1000} detik). Pastikan kode tidak memiliki infinite loop atau operasi pemblokir.`,
          executionTimeMs: Date.now() - startTime
        });
      }
    }, timeoutMs);

    let stdoutLimitExceeded = false;
    let stderrLimitExceeded = false;

    proc.stdout.on('data', (chunk) => {
      if (stdoutData.length < 8000) {
        stdoutData += chunk.toString('utf-8');
        if (stdoutData.length >= 8000 && !stdoutLimitExceeded) {
          stdoutLimitExceeded = true;
          try { proc.kill(); } catch (_) { try { proc.kill('SIGKILL'); } catch (_) {} }
        }
      }
    });

    proc.stderr.on('data', (chunk) => {
      if (stderrData.length < 4000) {
        stderrData += chunk.toString('utf-8');
        if (stderrData.length >= 4000 && !stderrLimitExceeded) {
          stderrLimitExceeded = true;
          try { proc.kill(); } catch (_) { try { proc.kill('SIGKILL'); } catch (_) {} }
        }
      }
    });

    proc.on('error', (err) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);
      resolve({
        success: false,
        output: `Error eksekusi subprocess Python: ${err.message}`,
        executionTimeMs: Date.now() - startTime
      });
    });

    proc.on('close', (code) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);
      const executionTimeMs = Date.now() - startTime;
      if (code !== 0 && !stdoutLimitExceeded) {
        let errText = stderrData.trim() || `Proses keluar dengan status kode error ${code}`;
        if (stderrLimitExceeded) {
          errText += '\n[Peringatan: Output stderr melebihi batas 4KB dan dipotong.]';
        }
        resolve({
          success: false,
          output: `Error eksekusi:\n${errText}\n\nSaran: Periksa traceback di atas untuk memperbaiki sintaks atau logika kode Anda.`,
          executionTimeMs
        });
      } else {
        let out = stdoutData.trim();
        if (stdoutLimitExceeded) {
          out = (out ? out + '\n\n' : '') + '[Peringatan: Output program melebihi batas buffer 8KB dan dihentikan untuk melindungi stabilitas sistem.]';
        }
        resolve({
          success: true,
          output: out || 'Kode berhasil dijalankan tanpa output (Gunakan fungsi print() untuk mencetak hasil keluaran).',
          executionTimeMs
        });
      }
    });
  });
}

// Fungsi Logika Agen: Penganalisis Web Kustom URL Mendalam (Deep Custom URL Web Content Analyzer)
async function jalankanRisetOtonom(taskId, topik, config = {}) {
  const task = dbTugasRiset[taskId];
  if (!task) return;

  let allSources = [];
  let scrapedPages = [];
  const masterResearchModel = config.finalModel || config.model || config.agent1Model || 'openrouter/free';

  // 1. Kumpulkan seluruh URL target kustom yang diberikan pengguna
  let targetUrls = Array.isArray(config.targetUrls) ? config.targetUrls.filter(Boolean) : [];
  if (config.urls && Array.isArray(config.urls)) {
    config.urls.forEach(u => { if (!targetUrls.includes(u)) targetUrls.push(u); });
  }
  const textUrls = extractCustomAnalysisUrls(`${topik} ${config.prompt || ''}`);
  textUrls.forEach(u => {
    if (!targetUrls.includes(u)) targetUrls.push(u);
  });

  // Pastikan URL memiliki format protokol https:// atau http://
  targetUrls = targetUrls.map(u => {
    let clean = String(u).trim();
    if (!/^https?:\/\//i.test(clean)) clean = 'https://' + clean;
    return clean;
  });

  // Eliminasi duplikat
  targetUrls = Array.from(new Set(targetUrls));

  if (targetUrls.length === 0) {
    task.status = 'gagal';
    task.error = 'Deep Research kini berfungsi sebagai Penganalisis Web Kustom URL. Harap sertakan minimal 1 tautan URL kustom (misal: https://example.com/artikel) untuk dianalisis.';
    task.currentStep = 'Gagal: Tidak ada URL kustom yang disediakan.';
    task.completedAt = new Date().toISOString();
    return;
  }

  try {
    // ==========================================
    // TAHAP 1/3: EKSTRAKSI KONTEN LENGKAP DARI URL KUSTOM
    // ==========================================
    task.currentStep = `[Langkah 1/3] Mengambil & mengekstrak konten lengkap dari ${targetUrls.length} URL kustom...`;
    task.progressPercent = 20;
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] [Langkah 1/3] Memulai ekstraksi web mendalam untuk ${targetUrls.length} URL: ${targetUrls.join(', ')}`);

    for (let idx = 0; idx < targetUrls.length; idx++) {
      if (task.aborted) break;
      const targetUrl = targetUrls[idx];
      let domain = targetUrl;
      try {
        const parsed = new URL(targetUrl);
        domain = parsed.hostname;
      } catch (_) {}

      task.currentStep = `[Langkah 1/3] Mengunduh konten halaman (${idx + 1}/${targetUrls.length}): ${domain}...`;
      task.progressPercent = 20 + Math.round(((idx + 1) / targetUrls.length) * 25);

      try {
        // Ekstraksi konten dengan browseWebPageContent dan fallback fetchPageDetails
        let browseRes = await browseWebPageContent(targetUrl, 16000);
        let contentText = (browseRes && browseRes.text && browseRes.text.length > 100) ? browseRes.text : '';
        let pageTitle = (browseRes && browseRes.title) ? browseRes.title : domain;

        if (!contentText || contentText.length < 100) {
          const detailRes = await fetchPageDetails(targetUrl, 16000);
          if (detailRes && detailRes.success && detailRes.content) {
            contentText = detailRes.content;
            pageTitle = detailRes.title || pageTitle;
          }
        }

        if (contentText && contentText.length > 50) {
          const pageItem = {
            url: targetUrl,
            domain: domain,
            title: pageTitle || domain,
            content: contentText,
            charCount: contentText.length,
            publishDate: browseRes?.publishDate || null
          };
          scrapedPages.push(pageItem);
          allSources.push({
            title: pageItem.title,
            url: targetUrl,
            domain: domain,
            snippet: contentText.slice(0, 300) + '...',
            sourceProvider: 'Custom URL Target'
          });
          task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] ✓ Berhasil mengekstrak [${domain}]: "${pageItem.title.slice(0, 45)}" (${pageItem.charCount} karakter)`);
        } else {
          task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] ⚠️ Konten dari [${domain}] terlalu minim atau terproteksi.`);
        }
      } catch (errScrape) {
        task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] ⚠️ Gagal mengekstrak [${domain}]: ${errScrape.message}`);
      }

      // Update snapshot Live Inspection
      task.liveInspection = {
        topik,
        mode: 'custom_url_analyzer',
        targetUrls,
        timestamp: new Date().toLocaleTimeString('id-ID'),
        scrapedPagesCount: scrapedPages.length,
        agent1: {
          name: 'Penganalisis Web Kustom URL (Ekstraksi Konten)',
          provider: 'Deep Web Extractor',
          model: masterResearchModel,
          resultsCount: scrapedPages.length,
          results: scrapedPages.map(p => ({ title: p.title, link: p.url, snippet: p.content.slice(0, 250) + '...', charCount: p.charCount })),
          analysis: `Berhasil mengekstrak ${scrapedPages.length} halaman web kustom utuh untuk telaah mendalam.`
        },
        scraper: {
          status: 'selesai',
          totalScraped: scrapedPages.length,
          temporalAnalysis: '',
          articles: scrapedPages.map(p => ({
            title: p.title,
            url: p.url,
            domain: p.domain,
            sourceProvider: 'URL Kustom Analisis',
            length: p.charCount,
            sample: p.content.slice(0, 300) + '...'
          }))
        },
        analyzer: {
          name: 'Penganalisis Web Kustom URL',
          model: masterResearchModel,
          urls: scrapedPages.map(p => ({
            url: p.url,
            domain: p.domain,
            title: p.title,
            charCount: p.charCount,
            sample: p.content.slice(0, 300) + '...'
          }))
        }
      };
    }

    if (scrapedPages.length === 0) {
      throw new Error(`Tidak dapat mengekstrak teks isi dari URL yang diberikan. Pastikan tautan dapat diakses publik.`);
    }

    // ==========================================
    // TAHAP 2/3: DEKONSTRUKSI KONTEN, ANALISIS DATA TERBARU VS DATA LAMA
    // ==========================================
    task.currentStep = `[Langkah 2/3] Model Riset (${masterResearchModel}) membedah struktur isi, mendeteksi fakta terbaru vs konteks lama...`;
    task.progressPercent = 60;
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] [Langkah 2/3] Model Riset (${masterResearchModel}) menganalisis mendalam: membedah isi, perubahan terbaru, dan status lama.`);

    const docsBlock = scrapedPages.map((p, idx) => `
=====================================================
DOKUMEN KUSTOM #${idx + 1}: ${p.title}
URL: ${p.url}
DOMAIN: ${p.domain}
=====================================================
${p.content.slice(0, 14000)}
=====================================================
`).join('\n\n');

    const promptBedahKomparatif = `Anda adalah Ahli Analisis Dokumen Web & Intelijen Data Kustom (Deep Custom URL Web Content Analyzer).
Instruksi Pengguna: "${topik}"

Berikut adalah isi teks LENGKAP dari URL kustom yang diberikan pengguna:
${docsBlock}

TUGAS ANDA:
Lakukan analisis mendalam dan kritis terhadap konten di atas dengan fokus pada 4 pilar analisis utama:
1. POKOK BAHASAN & STRUKTUR ISI: Apa tujuan, fungsi, topik, dan arsitektur yang dijelaskan di halaman ini?
2. INFORMASI & TEMUAN TERBARU (THE LATEST UPDATES): Apa fakta terbaru, versi rilis, fitur baru, tanggal pembaruan, perubahan kebijakan, atau data termutakhir yang dicantumkan?
3. KONTEKS & INFORMASI LAMA (HISTORICAL / LEGACY CONTEXT): Apa kondisi sebelumnya, versi terdahulu, status lama yang digantikan, atau informasi masa lalu yang menjadi dasar perbandingan?
4. KOMPARASI EVOLUSI (BARU VS LAMA): Apa perbedaan utama antara apa yang lama dengan apa yang baru? Apa yang ditinggalkan/dihapus (deprecated), dan apa yang menjadi standar baru?

Tuliskan telaah analitis mendalam dalam 3-5 paragraf berbobot teknis tinggi, padat fakta, dan objektif.`;

    let hasilBedahAnalisis = await callLLMBackend({
      ...config,
      messages: [],
      model: masterResearchModel,
      prompt: promptBedahKomparatif,
      system: 'Anda adalah Deep Research Web Content Analyzer yang objektif, kritis, dan sangat teliti dalam membedakan data baru vs lama.'
    }).catch(err => {
      console.warn('Gagal analisis bedah dokumen:', err?.message || err);
      return `[Analisis Ekstraksi Dokumen]:\n${scrapedPages.map(p => `- ${p.title} (${p.url}): ${p.content.slice(0, 400)}...`).join('\n')}`;
    });

    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] ✓ Bedah komparatif selesai: Model Riset berhasil mengekstrak poin isi, pembaruan terbaru, dan konteks lama.`);

    task.liveInspection = {
      ...(task.liveInspection || {}),
      agent2: {
        name: 'Dekonstruksi Konseptual & Analisis Struktur',
        provider: 'Neural Content Deconstructor',
        model: masterResearchModel,
        resultsCount: scrapedPages.length,
        analysis: hasilBedahAnalisis
      },
      scraper: {
        status: 'selesai',
        totalScraped: scrapedPages.length,
        temporalAnalysis: hasilBedahAnalisis,
        articles: scrapedPages.map(p => ({
          title: p.title,
          url: p.url,
          domain: p.domain,
          sourceProvider: 'URL Kustom Analisis',
          length: p.charCount,
          sample: p.content.slice(0, 350) + '...'
        }))
      }
    };

    // ==========================================
    // TAHAP 3/3: PENYUSUNAN LAPORAN EKSEKUTIF DENGAN MATRIKS KOMPARASI
    // ==========================================
    task.currentStep = `[Langkah 3/3] Menyusun Laporan Analisis Eksekutif Web & Matriks Komparasi...`;
    task.progressPercent = 85;
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] [Langkah 3/3] Menyusun Laporan Analisis Eksekutif lengkap dengan tabel perbandingan Baru vs Lama.`);

    const promptLaporanAkhir = `Anda adalah Lead Executive Research Architect.
Perintah / Pertanyaan Pengguna: "${topik}"
Daftar URL Kustom yang Dianalisis: ${targetUrls.join(', ')}

Hasil Telaah Analitis Mendalam:
${hasilBedahAnalisis}

Ringkasan Dokumen Sumber:
${docsBlock.slice(0, 8000)}

Susunlah LAPORAN ANALISIS MENDALAM WEB KUSTOM yang komprehensif, elegan, dan profesional dalam format Markdown lengkap dengan struktur hierarki berikut:

# 🌐 LAPORAN ANALISIS MENDALAM: PENGANALISIS WEB KUSTOM URL
> **URL Target:** ${targetUrls.map(u => `[${u}](${u})`).join(', ')}  
> **Fokus Analisis:** Dekonstruksi Konten Utuh, Data Terbaru vs Lama, & Matriks Evolusi  
> **Model Analisis:** ${masterResearchModel}  

---

## 1. 📌 Ringkasan Eksekutif & Identitas Sumber
(Jelaskan secara ringkas maksud halaman, entitas pemilik, topik sentral, dan ringkasan nilai informasi yang terkandung).

## 2. 🔍 Analisis Isi Mendalam (Core Content Breakdown)
(Bedah secara detail poin-poin utama, arsitektur, argumen, atau fungsi yang dijelaskan pada situs/halaman tersebut).

## 3. ⚡ Sorotan Temuan & Pembaruan Terbaru (The Latest Updates)
(Uraikan secara spesifik apa saja fakta, versi, fitur, tanggal revisi, atau kebijakan terbaru yang diumumkan atau tercatat di URL ini).

## 4. 📜 Konteks Historis & Informasi Terdahulu (Past Context & Legacy Info)
(Jelaskan latar belakang lama, versi sebelumnya, kondisi sebelum pembaruan, atau baseline terdahulu yang disebutkan).

## 5. ⚖️ Matriks Komparasi Evolusi (Tabel: Kondisi Lama vs Kondisi Baru)
(Buat tabel Markdown terstruktur yang membandingkan: Aspek/Fitur | Kondisi / Versi Lama | Kondisi / Versi Terbaru | Dampak / Manfaat).

## 6. 💡 Implikasi Kritis, Keabsahan & Rekomendasi Praktis
(Berikan evaluasi kritis terhadap validitas informasi, implikasi bagi pengguna/developer/industri, serta langkah rekomendasi konkret).

## 7. 🔗 Referensi Sumber Kustom Terverifikasi
(Daftar tautan asli lengkap yang dapat diklik langsung oleh pengguna).

Instruksi Tambahan:
- Buat laporan komprehensif, padat data, dan profesional.
- JANGAN memotong bagian laporan.`;

    let laporanAkhir = await callLLMBackend({
      ...config,
      messages: [],
      model: masterResearchModel,
      prompt: promptLaporanAkhir,
      system: 'Anda adalah Executive Research Architect yang menyusun laporan riset tingkat tinggi yang terstruktur rapi.'
    }).catch(err => {
      console.warn('Gagal menyusun laporan akhir:', err?.message || err);
      return `# 🌐 LAPORAN ANALISIS MENDALAM: PENGANALISIS WEB KUSTOM URL\n\n> URL Target: ${targetUrls.join(', ')}\n\n${hasilBedahAnalisis}`;
    });

    // Buat rangkuman chat eksekutif untuk respon chat ringkas yang langsung menjawab inti pertanyaan
    const promptChatSummary = `Anda adalah Executive Chat Summarizer.
Pertanyaan Pengguna: "${topik}"
Laporan Analisis Web Lengkap:
${laporanAkhir.slice(0, 6000)}

Tugas:
Tuliskan jawaban langsung yang ringkas, elegan, dan to-the-point (2-3 paragraf) dalam percakapan chat yang menjelaskan:
1. Inti isi halaman web yang dianalisis.
2. Apa yang paling baru dan apa yang lama/berubah.
3. Kesimpulan utama bagi pengguna.
Tuliskan langsung jawabannya dengan gaya ramah dan profesional.`;

    let chatSummary = await callLLMBackend({
      ...config,
      messages: [],
      model: masterResearchModel,
      prompt: promptChatSummary,
      system: 'Anda adalah AI Assistant yang ramah, efisien, dan komunikatif.'
    }).catch(() => '');

    if (task.aborted) {
      task.status = 'dibatalkan';
      task.currentStep = 'Riset dihentikan oleh pengguna.';
      task.completedAt = new Date().toISOString();
      if (config.sessionId && task.hasil) {
        appendAssistantMessageToSessionDisk(config.sessionId, task.hasil + '\n\n*[Riset dihentikan oleh pengguna]*', masterResearchModel, {
          userId: (task && task.userId) || config.userId || 'default',
          isDeepResearch: true,
          chatSummary: chatSummary,
          sources: allSources
        }).catch(err => console.warn('Gagal simpan riset terhenti ke sesi:', err && err.message));
      }
      return;
    }

    task.status = 'selesai';
    task.progressPercent = 100;
    task.currentStep = 'Laporan Analisis Web Kustom URL Berhasil Disusun.';
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] Analisis selesai sempurna: Laporan Komparasi Lengkap & Rangkuman Eksekutif siap.`);
    task.hasil = laporanAkhir;
    task.chatSummary = chatSummary;
    task.sources = allSources;
    task.completedAt = new Date().toISOString();
    task.liveInspection = {
      ...(task.liveInspection || {}),
      synthesizer: {
        name: 'Laporan Analisis Eksekutif Komprehensif & Matriks Komparasi',
        model: masterResearchModel,
        status: 'selesai',
        text: laporanAkhir,
        length: (laporanAkhir || '').length
      },
      model4: {
        name: 'Rangkuman Eksekutif Percakapan Chat',
        model: masterResearchModel,
        status: 'selesai',
        text: chatSummary,
        length: (chatSummary || '').length
      }
    };

    if (config.sessionId) {
      appendAssistantMessageToSessionDisk(config.sessionId, laporanAkhir, masterResearchModel, {
        userId: (task && task.userId) || config.userId || 'default',
        isDeepResearch: true,
        chatSummary: chatSummary,
        sources: allSources
      }).catch(err => console.warn('Gagal simpan laporan riset ke sesi:', err && err.message));
    }

  } catch (error) {
    console.error('Deep custom URL analysis failed:', error);
    task.status = 'gagal';
    task.error = error.message;
    task.currentStep = 'Analisis gagal: ' + error.message;
    task.completedAt = new Date().toISOString();
  }
}

// Main HTTP Request Handler & Server
async function requestHandler(req, res) {
  if (!req) return;
  if (!req.headers || typeof req.headers !== 'object') req.headers = {};
  let reqUrl;
  try {
    reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost:4040'}`);
  } catch (_) {
    try {
      reqUrl = new URL(req.url, 'http://localhost:4040');
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Bad Request: Invalid URL');
    }
  }
  const pathname = reqUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Private-Network': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint, x-title, HTTP-Referer, x-serper-key, x-ollama-key, x-api-key, x-openrouter-key, x-session-id, X-Session-ID, x-user-id, X-User-ID, x-client-id, X-Client-ID, x-user-token, X-User-Token, x-terminal-pin, X-Terminal-Pin, Access-Control-Request-Private-Network'
    });
    return res.end();
  }

  // ===== GERBANG LINTAS-ASAL UNTUK /api (SEBELUM registrasi identitas) =====
  // Sebagian endpoint memakai key milik SERVER (env OPENROUTER_API_KEY/SERPER_API_KEY
  // /OLLAMA_API_KEY) sebagai fallback. Tanpa gerbang ini, halaman web jahat mana pun
  // bisa memanggil API dari browser korban (ACAO:*) dan membakar kredit API operator.
  // Pengecualian mutlak: /api/ping dan /api/health adalah status probe harmless.
  // Front-end resmi (.vercel.app, localhost, loopback) atau ZOX_ALLOW_CROSS_ORIGIN=1 selalu diizinkan.
  if (pathname.startsWith('/api') && pathname !== '/api/ping' && pathname !== '/api/health' && process.env.ZOX_ALLOW_CROSS_ORIGIN !== '1') {
    let crossSite = false;
    if (req.headers.origin) {
      try {
        const originUrl = new URL(req.headers.origin);
        const originHost = originUrl.host.toLowerCase();
        const forwardHost = (req.headers['x-forwarded-host'] || '').toLowerCase();
        const reqHost = (req.headers.host || '').toLowerCase();
        const isTrusted = (originHost === reqHost) ||
                          (forwardHost && originHost === forwardHost) ||
                          originHost === 'zoz-router.vercel.app' ||
                          originHost.endsWith('.vercel.app') ||
                          originHost.endsWith('localhost') ||
                          originHost.startsWith('127.0.0.1') ||
                          originHost.startsWith('[::1]') ||
                          originHost.endsWith('.trycloudflare.com') ||
                          reqHost.endsWith('.trycloudflare.com') ||
                          pathname.startsWith('/api/terminal/tunnel');
        crossSite = !isTrusted;
      } catch (_) {
        crossSite = true;
      }
    } else if (req.headers['sec-fetch-site'] === 'cross-site') {
      crossSite = true;
    }
    if (crossSite) {
      return sendJSON(res, 403, { error: 'Akses API lintas-asal ditolak. Bila front-end Anda sengaja dihosting di domain berbeda, setel ZOX_ALLOW_CROSS_ORIGIN=1 di server.' });
    }
  }

  // ===== RATE LIMIT (M22) — sebelum identitas agar banjir tak sempat menulis registry =====
  if (pathname.startsWith('/api') && pathname !== '/api/health' && pathname !== '/api/ping') {
    const retryAfter = rateLimitCheck(req, RATE_LIMIT_GENERAL);
    if (retryAfter !== null) {
      res.setHeader('Retry-After', String(retryAfter));
      return sendJSON(res, 429, { error: 'Terlalu banyak permintaan dari alamat ini. Coba lagi dalam ' + retryAfter + ' detik.' });
    }
    if (pathname === '/api/sessions' && method === 'POST') {
      const writeRetry = rateLimitCheck(req, RATE_LIMIT_SESSION_WRITE);
      if (writeRetry !== null) {
        res.setHeader('Retry-After', String(writeRetry));
        return sendJSON(res, 429, { error: 'Terlalu banyak penyimpanan sesi. Coba lagi dalam ' + writeRetry + ' detik.' });
      }
    }
  }

  // ===== RESOLUSI IDENTITAS (sekali per request, sebelum semua rute) =====
  // Menolak lebih awal request dengan identitas tidak valid / token salah, agar
  // seluruh rute di bawah ini hanya melihat reqUserId yang sudah tervalidasi.
  const identityResult = resolveRequestIdentity(req, reqUrl);
  if (identityResult.error) {
    return sendJSON(res, identityResult.status || 400, { error: identityResult.error });
  }
  const reqUserId = identityResult.userId;

  // Helper: safe parseBody wrapper that converts rejection to 400 response
  async function safeParseBody(req) {
    try {
      return await parseBody(req);
    } catch (e) {
      const msg = e && e.message ? e.message : 'Body JSON tidak valid.';
      sendJSON(res, 400, { error: msg });
      return null; // signal to caller to return early
    }
  }

  // --- API ROUTES ---

  // Gateway root info
  if ((pathname === '/api' || pathname === '/api/') && method === 'GET') {
    return sendJSON(res, 200, {
      status: 'online',
      name: 'ZOZ ROUTER Neural Gateway',
      version: '1.0.0',
      cloud: Boolean(IS_VERCEL_ENV),
      timestamp: new Date().toISOString()
    });
  }

  // Health check
  if (pathname === '/api/health' && method === 'GET') {
    return sendJSON(res, 200, {
      status: 'online',
      name: 'Zoz Router',
      version: '1.0.0',
      storage: IS_VERCEL_ENV ? 'cloud-stateless' : 'device-disk',
      uptime: process.uptime(),
      lastUncaught: lastUncaughtInfo, // F19: exception di luar request terlihat di sini
      timestamp: new Date().toISOString()
    });
  }

  if (pathname === '/api/ping' && method === 'GET') {
    const isRemote = isRemoteTunnelRequest(req);
    const pinCheck = validateRemoteTerminalPin(req, reqUrl, null);
    return sendJSON(res, 200, {
      ok: true,
      status: 'healthy',
      time: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      mode: 'standalone-engine',
      uptime: process.uptime(),
      memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      isRemote,
      tunnelActive: cloudflareTunnelActive,
      authenticated: pinCheck.valid
    });
  }

  // --- DEVICE STORAGE: SESSIONS & CHAT HISTORY ---
  const sessionMatch = pathname.match(/^\/api\/sessions\/([a-zA-Z0-9_-]+)$/);

  // 1. List all sessions (Lightweight summaries)
  if (pathname === '/api/sessions' && method === 'GET') {
    try {
      const rawUserDir = path.join(SESSIONS_DIR, reqUserId);
      // Adopsi dipicu bila dir pengguna belum pernah dibuat ATAU masih kosong.
      // Kondisi kedua penting: getUserSessionsDir membuat folder pada permintaan
      // apa pun (mis. POST /api/sessions terjadi sebelum GET), sehingga folder bisa
      // terbentuk lebih dulu dan sesi legacy terdampar selamanya di 'default/'.
      const userDirHasSessions = fs.existsSync(rawUserDir) &&
        fs.readdirSync(rawUserDir).some(f => f.endsWith('.json'));

      // ADOPSI SESI LEGACY: sebelum ada identitas pengguna, seluruh sesi hidup di
      // data/sessions/ (lalu dipindahkan migrasi ke data/sessions/default/). Klien kini
      // mengirim X-User-ID sehingga hanya membaca data/sessions/<userId>/ — tanpa langkah
      // ini riwayat lama menjadi tak terlihat sama sekali. Pemindahan dilakukan bila
      // pengguna belum memiliki sesi, sehingga sesi lama langsung menjadi privat miliknya.
      // PENGERAT: adopsi hanya boleh terjadi SEKALI sepanjang umur server
      // (penanda .legacy_adopted) — tanpa ini, setiap pengguna baru yang folder-nya
      // kosong bisa "mencuri" seluruh sesi default/ (pemindahan permanen).
      const legacyAdoptMarker = path.join(SESSIONS_DIR, '.legacy_adopted');
      const legacyAlreadyAdopted = fs.existsSync(legacyAdoptMarker);
      if (!userDirHasSessions && reqUserId !== 'default' && !legacyAlreadyAdopted) {
        const legacyDir = path.join(SESSIONS_DIR, 'default');
        if (fs.existsSync(legacyDir)) {
          const legacyFiles = fs.readdirSync(legacyDir).filter(f => f.endsWith('.json'));
          if (legacyFiles.length > 0) {
            let adoptedCount = 0;
            try { fs.mkdirSync(rawUserDir, { recursive: true }); } catch (_) {}
            for (const lf of legacyFiles) {
              try {
                const srcFile = path.join(legacyDir, lf);
                const dstFile = path.join(rawUserDir, lf);
                if (fs.existsSync(dstFile)) {
                  fs.unlinkSync(srcFile);
                  adoptedCount++;
                  continue;
                }
                fs.renameSync(srcFile, dstFile);
                adoptedCount++;
                // Stempel pemilik agar konsisten dengan partisi penyimpanan
                try {
                  const obj = JSON.parse(fs.readFileSync(dstFile, 'utf8'));
                  obj.userId = reqUserId;
                  fs.writeFileSync(dstFile, JSON.stringify(obj, null, 2), 'utf8');
                } catch (_) {}
              } catch (_) {}
            }
            // Tulis penanda SEKALI ADOPSI BERHASIL — adopsi tidak akan pernah
            // terjadi lagi, sehingga user baru berikutnya tidak bisa mengklaim
            // sisa sesi legacy (adopsi = kepindahan permanen, bukan salinan).
            if (adoptedCount > 0) {
              try {
                fs.writeFileSync(legacyAdoptMarker, JSON.stringify({ adoptedBy: reqUserId, count: adoptedCount, at: new Date().toISOString() }, null, 2), 'utf8');
              } catch (_) {}
            }
          }
        }
      }

      const userDir = getUserSessionsDir(reqUserId);
      if (!fs.existsSync(userDir)) {
        return sendJSON(res, 200, { sessions: [] });
      }
      const files = (await fsp.readdir(userDir)).filter(f => f.endsWith('.json'));
      const sessions = [];
      for (const file of files) {
        try {
          const fullPath = path.join(userDir, file);
          const content = await fsp.readFile(fullPath, 'utf8');
          const sess = JSON.parse(content);
          const lastMsg = (sess.messages && sess.messages.length > 0) ? sess.messages[sess.messages.length - 1].content : '';
          // stat hanya saat createdAt/updatedAt tidak ada di isi file (hemat 2 syscall/file)
          let createdAt = sess.createdAt;
          let updatedAt = sess.updatedAt;
          if (!createdAt || !updatedAt) {
            const st = await fsp.stat(fullPath);
            createdAt = createdAt || st.birthtime.toISOString();
            updatedAt = updatedAt || st.mtime.toISOString();
          }
          sessions.push({
            id: sess.id || path.basename(file, '.json'),
            userId: reqUserId,
            title: sess.title || 'Obrolan Baru',
            mode: sess.mode || 'ollama',
            createdAt,
            updatedAt,
            messageCount: Array.isArray(sess.messages) ? sess.messages.length : 0,
            isPinned: !!sess.isPinned,
            lastSnippet: (typeof lastMsg === 'string') ? lastMsg.substring(0, 80) : ''
          });
        } catch (fe) {}
      }
      sessions.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      return sendJSON(res, 200, { sessions });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal membaca riwayat sesi dari perangkat: ' + err.message });
    }
  }

  // 2. Get specific session full data
  if (sessionMatch && method === 'GET') {
    const validation = validateSessionId(sessionMatch[1], reqUserId);
    if (!validation.valid) return sendJSON(res, 400, { error: validation.error });
    const { id, sessFile } = validation;
    if (!fs.existsSync(sessFile)) {
      return sendJSON(res, 404, { error: 'Sesi tidak ditemukan di penyimpanan perangkat Anda.' });
    }
    try {
      const data = JSON.parse(fs.readFileSync(sessFile, 'utf8'));
      return sendJSON(res, 200, data);
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal memuat file sesi: ' + err.message });
    }
  }

  // 3. Create or save session to disk
  if (pathname === '/api/sessions' && method === 'POST') {
    const body = await safeParseBody(req);
    if (!body) return;
    try {
      const rawId = (body && body.id) ? String(body.id).trim() : ('ses_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6));
      const effectiveUid = reqUserId; // identitas HANYA dari header tervalidasi — body.userId tidak dipercaya
      const validation = validateSessionId(rawId, effectiveUid);
      if (!validation.valid) return sendJSON(res, 400, { error: validation.error });
      const { id, sessFile, userDir } = validation;
      body.updatedAt = new Date().toISOString();
      body.id = id;
      body.userId = effectiveUid;
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      const tempFile = sessFile + `.tmp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      try {
        await fsp.writeFile(tempFile, JSON.stringify(body, null, 2), 'utf8');
        safeAtomicRenameSync(tempFile, sessFile);
      } catch (err) {
        try { fs.unlinkSync(tempFile); } catch {}
        throw err;
      }
      return sendJSON(res, 200, { success: true, session: body });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal menyimpan sesi ke disk perangkat: ' + err.message });
    }
  }

  // 4. Update session (Rename / Edit title / Merge update)
  if (sessionMatch && (method === 'PUT' || method === 'PATCH')) {
    const validation = validateSessionId(sessionMatch[1], reqUserId);
    if (!validation.valid) return sendJSON(res, 400, { error: validation.error });
    const { id, sessFile, userDir } = validation;
    const body = await safeParseBody(req);
    if (!body) return;
    try {
      let existing = {};
      if (fs.existsSync(sessFile)) {
        try { existing = JSON.parse(fs.readFileSync(sessFile, 'utf8')); } catch (e) {}
      }
      const updated = {
        ...existing,
        ...body,
        id: id,
        userId: reqUserId,
        updatedAt: new Date().toISOString()
      };
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      const tempFile = sessFile + `.tmp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      try {
        await fsp.writeFile(tempFile, JSON.stringify(updated, null, 2), 'utf8');
        safeAtomicRenameSync(tempFile, sessFile);
      } catch (err) {
        try { fs.unlinkSync(tempFile); } catch {}
        throw err;
      }
      return sendJSON(res, 200, { success: true, session: updated });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal memperbarui sesi di disk: ' + err.message });
    }
  }

  // 5. Delete specific session file from disk
  if (sessionMatch && method === 'DELETE') {
    const validation = validateSessionId(sessionMatch[1], reqUserId);
    if (!validation.valid) return sendJSON(res, 400, { error: validation.error });
    const { id, sessFile } = validation;
    try {
      // Hentikan tugas background chat aktif untuk sesi ini hanya jika milik user ini
      if (id && dbActiveChatTasks[id]) {
        const bgTask = dbActiveChatTasks[id];
        if (!bgTask.userId || bgTask.userId === reqUserId) {
          bgTask.status = 'aborted';
          if (bgTask.proxyReq && !bgTask.proxyReq.destroyed) {
            try { bgTask.proxyReq.destroy(); } catch (_) {}
          }
          delete dbActiveChatTasks[id];
        }
      }

      // Hentikan tugas Deep Research aktif untuk sesi ini jika ada dan milik user ini
      for (const rId of Object.keys(dbTugasRiset)) {
        const rTask = dbTugasRiset[rId];
        if (rTask && (rTask.sessionId === id || rTask.taskId === id)) {
          if (!rTask.userId || rTask.userId === reqUserId) {
            rTask.aborted = true;
            rTask.status = 'dibatalkan';
            delete dbTugasRiset[rId];
          }
        }
      }

      if (!fs.existsSync(sessFile)) {
        return sendJSON(res, 404, { error: `Sesi ${id} tidak ditemukan di penyimpanan Anda.` });
      }
      fs.unlinkSync(sessFile);
      return sendJSON(res, 200, { success: true, message: `Sesi ${id} berhasil dihapus dari penyimpanan perangkat Anda.` });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal menghapus file sesi dari disk: ' + err.message });
    }
  }

  // 6. Delete all sessions from disk
  if (pathname === '/api/sessions' && method === 'DELETE') {
    try {
      // Hentikan tugas background chat hanya untuk user ini
      for (const sid of Object.keys(dbActiveChatTasks)) {
        const bgTask = dbActiveChatTasks[sid];
        if (bgTask && (!bgTask.userId || bgTask.userId === reqUserId)) {
          bgTask.status = 'aborted';
          if (bgTask.proxyReq && !bgTask.proxyReq.destroyed) {
            try { bgTask.proxyReq.destroy(); } catch (_) {}
          }
          delete dbActiveChatTasks[sid];
        }
      }

      // Hentikan tugas Deep Research hanya untuk user ini
      for (const rId of Object.keys(dbTugasRiset)) {
        const rTask = dbTugasRiset[rId];
        if (rTask && (!rTask.userId || rTask.userId === reqUserId)) {
          rTask.aborted = true;
          rTask.status = 'dibatalkan';
          delete dbTugasRiset[rId];
        }
      }

      const userDir = getUserSessionsDir(reqUserId);
      if (fs.existsSync(userDir)) {
        const files = fs.readdirSync(userDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try { fs.unlinkSync(path.join(userDir, file)); } catch (e) {}
        }
      }
      return sendJSON(res, 200, { success: true, message: 'Semua riwayat sesi Anda berhasil dibersihkan.' });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal membersihkan riwayat: ' + err.message });
    }
  }

  // 7. Native Media Upload to Disk (Stores files in data/uploads/)
  if (pathname === '/api/upload' && method === 'POST') {
    const body = await safeParseBody(req);
    if (!body) return;
    if (!body.data) {
      return sendJSON(res, 400, { error: 'Data gambar atau file diperlukan.' });
    }
      let rawData = String(body.data).trim();
      let ext = '.png';
      let base64Content = rawData;

      // Match standard Data URL format: data:<mediatype>[;charset=utf-8][;base64],<data>
      const dataUrlMatch = rawData.match(/^data:([a-zA-Z0-9.+_-]+\/[a-zA-Z0-9.+_-]+)(?:;[a-zA-Z0-9=._-]+)*;base64,(.*)$/s);
      if (dataUrlMatch) {
        const mime = dataUrlMatch[1].toLowerCase();
        base64Content = dataUrlMatch[2];
        
        const MIME_MAP = {
          'image/png': '.png',
          'image/jpeg': '.jpg',
          'image/jpg': '.jpg',
          'image/webp': '.webp',
          'image/gif': '.gif',
          'image/svg+xml': '.svg',
          'image/x-icon': '.ico',
          'image/vnd.microsoft.icon': '.ico',
          'audio/mpeg': '.mp3',
          'audio/mp3': '.mp3',
          'audio/wav': '.wav',
          'audio/x-wav': '.wav',
          'audio/ogg': '.ogg',
          'audio/mp4': '.m4a',
          'audio/x-m4a': '.m4a',
          'audio/m4a': '.m4a',
          'audio/aac': '.aac',
          'audio/flac': '.flac',
          'audio/x-flac': '.flac',
          'audio/webm': '.weba',
          'video/mp4': '.mp4',
          'video/webm': '.webm',
          'video/ogg': '.ogv',
          'application/pdf': '.pdf',
          'text/plain': '.txt'
        };

        if (MIME_MAP[mime]) {
          ext = MIME_MAP[mime];
        } else {
          const sub = mime.split('/')[1] || '';
          if (sub.includes('svg')) ext = '.svg';
          else if (sub.includes('jpeg') || sub.includes('jpg')) ext = '.jpg';
          else if (sub.includes('png')) ext = '.png';
          else if (sub.includes('webp')) ext = '.webp';
          else if (sub.includes('gif')) ext = '.gif';
          else if (sub.includes('mpeg') || sub.includes('mp3')) ext = '.mp3';
          else if (sub.includes('wav')) ext = '.wav';
          else if (sub.includes('ogg')) ext = mime.startsWith('video') ? '.ogv' : '.ogg';
          else if (sub.includes('flac')) ext = '.flac';
          else if (sub.includes('aac')) ext = '.aac';
          else if (sub.includes('m4a')) ext = '.m4a';
          else if (sub.includes('mp4')) ext = mime.startsWith('audio') ? '.m4a' : '.mp4';
          else if (sub.includes('webm')) ext = mime.startsWith('audio') ? '.weba' : '.webm';
          else if (sub.includes('pdf')) ext = '.pdf';
          else ext = '.bin';
        }
      } else {
        base64Content = rawData.replace(/^data:[^;]+;base64,/, '');
      }

      const buffer = Buffer.from(base64Content, 'base64');
      if (!buffer || buffer.length === 0) {
        return sendJSON(res, 400, { error: 'Data base64 tidak valid atau kosong.' });
      }

      try {
        // F17: nama acak kriptografis (bukan Math.random 6 char yang bisa ditebak)
        const filename = `media_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
        if (!fs.existsSync(UPLOADS_DIR)) {
          fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        const targetFile = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(targetFile, buffer);
        return sendJSON(res, 200, {
          success: true,
          url: `/uploads/${filename}`,
          filename,
          size: buffer.length
        });
      } catch (err) {
        return sendJSON(res, 500, { error: 'Gagal menyimpan file ke disk perangkat: ' + err.message });
      }
  }

  // 8. Serve Uploaded Media from Disk
  if (pathname.startsWith('/uploads/')) {
    if (method !== 'GET' && method !== 'HEAD') {
      return sendJSON(res, 405, { error: 'Method Not Allowed' });
    }
    let decodedUploadPath = pathname;
    try {
      decodedUploadPath = decodeURIComponent(pathname);
    } catch (_) {}
    const uploadFilename = path.basename(decodedUploadPath);
    const resolvedUploadDir = path.resolve(UPLOADS_DIR);
    const resolvedUploadFile = path.resolve(UPLOADS_DIR, uploadFilename);
    if (!resolvedUploadFile.startsWith(resolvedUploadDir + path.sep)) {
      return sendJSON(res, 403, { error: 'Forbidden' });
    }
    const uploadFilePath = resolvedUploadFile;
    try {
      if (fs.existsSync(uploadFilePath)) {
        const stat = fs.statSync(uploadFilePath);
        if (stat.isFile()) {
          const ext = path.extname(uploadFilePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';
          const totalSize = stat.size;
          const range = req.headers.range;

          let isRangeRequest = false;
          let start = 0;
          let end = totalSize - 1;

          if (range && typeof range === 'string' && range.startsWith('bytes=')) {
            const parts = range.replace(/^bytes=/, '').trim().split('-');
            const rawStart = parts[0];
            const rawEnd = parts[1];

            if (rawStart === '' && rawEnd !== '') {
              // Suffix byte range (e.g. bytes=-500)
              const suffixLen = parseInt(rawEnd, 10);
              if (!isNaN(suffixLen) && suffixLen > 0) {
                start = Math.max(0, totalSize - suffixLen);
                end = totalSize - 1;
                isRangeRequest = true;
              }
            } else if (rawStart !== '') {
              start = parseInt(rawStart, 10);
              if (!isNaN(start)) {
                if (rawEnd !== '') {
                  const parsedEnd = parseInt(rawEnd, 10);
                  if (!isNaN(parsedEnd)) {
                    end = Math.min(parsedEnd, totalSize - 1);
                  }
                }
                isRangeRequest = true;
              }
            }

            if (isRangeRequest) {
              if (start >= totalSize || start > end || start < 0) {
                res.writeHead(416, {
                  'Content-Range': `bytes */${totalSize}`,
                  'Access-Control-Allow-Origin': '*',
                  'X-Content-Type-Options': 'nosniff'
                });
                return res.end();
              }
            }
          }

          if (isRangeRequest) {
            const chunkSize = (end - start) + 1;
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize,
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': '*',
              'X-Content-Type-Options': 'nosniff',
              'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox"
            });

            if (method === 'HEAD') {
              return res.end();
            }

            const stream = fs.createReadStream(uploadFilePath, { start, end });
            stream.on('error', (err) => {
              console.error('[Upload Range Stream Error]:', err?.message || err);
              if (!res.headersSent) {
                sendJSON(res, 500, { error: 'Gagal membaca segmen media' });
              } else {
                try { res.destroy(); } catch (_) {}
              }
            });
            res.on('close', () => {
              if (!res.writableEnded) {
                try { stream.destroy(); } catch (_) {}
              }
            });
            res.on('error', (err) => {
              console.error('[Upload Range Response Error]:', err?.message || err);
              try { stream.destroy(); } catch (_) {}
            });
            stream.pipe(res);
            return;
          }

          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': totalSize,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox"
          });
          if (method === 'HEAD') {
            return res.end();
          }
          const stream = fs.createReadStream(uploadFilePath);
          stream.on('error', (err) => {
            console.error('[Upload Stream Error]:', err?.message || err);
            if (!res.headersSent) {
              sendJSON(res, 500, { error: 'Gagal membaca berkas media' });
            } else {
              try { res.destroy(); } catch (_) {}
            }
          });
          req.on('close', () => {
            try { stream.destroy(); } catch (_) {}
          });
          res.on('error', (err) => {
            console.error('[Upload Response Error]:', err?.message || err);
            try { stream.destroy(); } catch (_) {}
          });
          stream.pipe(res);
          return;
        }
      }
      return sendJSON(res, 404, { error: 'Media file tidak ditemukan di penyimpanan perangkat.' });
    } catch (fsErr) {
      if (!res.headersSent) {
        return sendJSON(res, 500, { error: 'Gagal mengakses berkas media: ' + fsErr.message });
      } else {
        try { res.destroy(); } catch (_) {}
        return;
      }
    }
  }

// Web Search API Endpoint (Serper Google Search Engine)
  if (pathname === '/api/web-search' && (method === 'GET' || method === 'POST')) {
    try {
      let query = reqUrl.searchParams.get('q') || reqUrl.searchParams.get('query') || reqUrl.searchParams.get('search') || reqUrl.searchParams.get('keyword') || reqUrl.searchParams.get('topic') || reqUrl.searchParams.get('topik') || reqUrl.searchParams.get('text') || reqUrl.searchParams.get('cari') || reqUrl.searchParams.get('kata_kunci') || '';
      let apiKey = req.headers['x-serper-key'] || req.headers['x-api-key'] || '';
      let num = parseInt(reqUrl.searchParams.get('num') || reqUrl.searchParams.get('limit') || '15', 10);
      if (method === 'POST') {
        const body = await safeParseBody(req);
        if (!body) return;
        query = body.query || body.q || body.search || body.keyword || body.topic || body.topik || body.text || body.cari || body.kata_kunci || query;
        apiKey = body.apiKey || body.serperApiKey || body.key || apiKey;
        if (body.num || body.limit) num = parseInt(body.num || body.limit, 10);
      }
      if (!query) {
        return sendJSON(res, 400, { error: 'Parameter query `q` atau body `{ query }` diperlukan.' });
      }
      // Endpoint Serper-MURNI: tanpa key, hasil pasti kosong → gagal nyata (503)
      // alih-alih 200 dengan results[] kosong yang menyesatkan klien.
      const effectiveSerperKey = apiKey || process.env.SERPER_API_KEY || null;
      if (!effectiveSerperKey) {
        return sendJSON(res, 503, {
          success: false,
          error: 'SERPER_API_KEY belum dikonfigurasi di server. Set env SERPER_API_KEY atau masukkan key di Pengaturan.'
        });
      }
      const targetNum = Math.min(Math.max(isNaN(num) ? 15 : num, 1), 30);
      const data = await performWebSearch(query, apiKey, targetNum);
      return sendJSON(res, 200, data);
    } catch (e) {
      return sendJSON(res, 500, { error: 'Gagal melakukan pencarian web Serper: ' + e.message });
    }
  }

  // Autonomous Web Search Tool Endpoint (Built from 0, Zero-API, No Serper API)
  if ((pathname === '/api/tools/search-web' || pathname === '/api/autonomous/search') && (method === 'GET' || method === 'POST')) {
    try {
      let query = reqUrl.searchParams.get('q') || reqUrl.searchParams.get('query') || reqUrl.searchParams.get('search') || reqUrl.searchParams.get('keyword') || reqUrl.searchParams.get('topic') || reqUrl.searchParams.get('topik') || reqUrl.searchParams.get('text') || reqUrl.searchParams.get('cari') || reqUrl.searchParams.get('kata_kunci') || '';
      let context = reqUrl.searchParams.get('context') || '';
      let maxResults = parseInt(reqUrl.searchParams.get('maxResults') || '8', 10);
      if (method === 'POST') {
        const body = await safeParseBody(req);
        if (!body) return;
        query = body.query || body.q || body.search || body.keyword || body.topic || body.topik || body.text || body.cari || body.kata_kunci || query;
        context = body.context || body.conversationContext || context;
        if (body.maxResults) maxResults = parseInt(body.maxResults, 10);
      }
      if (!query || !query.trim()) {
        return sendJSON(res, 400, { error: 'Parameter query `query` atau `q` diperlukan.' });
      }
      const safeMaxResults = Math.min(Math.max(isNaN(maxResults) ? 8 : maxResults, 1), 30);
      const data = await performAutonomousSearch(query, safeMaxResults, context);
      return sendJSON(res, 200, { success: true, ...data });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Gagal menjalankan tool pencarian web otonom: ' + e.message });
    }
  }

  // Autonomous Web Browse & Page Reading Tool Endpoint (Built from 0)
  if ((pathname === '/api/tools/browse-page' || pathname === '/api/autonomous/browse') && (method === 'GET' || method === 'POST')) {
    try {
      let targetUrl = reqUrl.searchParams.get('url') || reqUrl.searchParams.get('target') || reqUrl.searchParams.get('targetUrl') || reqUrl.searchParams.get('link') || reqUrl.searchParams.get('tautan') || '';
      let maxChars = parseInt(reqUrl.searchParams.get('maxChars') || '5000', 10);
      if (method === 'POST') {
        const body = await safeParseBody(req);
        if (!body) return;
        targetUrl = body.url || body.targetUrl || body.link || body.target || body.tautan || targetUrl;
        if (body.maxChars) maxChars = parseInt(body.maxChars, 10);
      }
      if (!targetUrl || !targetUrl.trim()) {
        return sendJSON(res, 400, { error: 'Parameter `url` diperlukan untuk membaca konten halaman.' });
      }
      const safeMaxChars = Math.min(Math.max(isNaN(maxChars) ? 5000 : maxChars, 200), 50000);
      const data = await browseWebPageContent(targetUrl, safeMaxChars);
      return sendJSON(res, 200, { success: true, ...data });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Gagal membaca halaman web: ' + e.message });
    }
  }

  // Long-Term Memory Save Tool Endpoint (SQLite FTS5)
  if ((pathname === '/api/memory/save' || pathname === '/api/tools/memory/save') && method === 'POST') {
    try {
      const body = await safeParseBody(req);
      if (!body) return;
      const content = String(body.content || body.value || body.text || body.fact || body.note || body.catatan || body.info || body.data || body.isi || body.konten || '').trim();
      let topic = String(body.topic || body.key || body.title || body.subject || body.kategori || body.topik || '').trim();
      if (!content) {
        return sendJSON(res, 400, { error: 'Parameter `content` (atau teks fakta) diperlukan untuk menyimpan memori.' });
      }
      if (!topic) {
        topic = content.split(/\s+/).slice(0, 4).join('_').replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase() || 'catatan';
      }
      const saveRes = saveMemoryRecord(reqUserId, topic, content);
      return sendJSON(res, 200, {
        success: true,
        message: `Berhasil menyimpan memori tentang: "${topic}"`,
        ...saveRes
      });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Gagal menyimpan memori: ' + e.message });
    }
  }

  // Long-Term Memory Search Tool Endpoint (SQLite FTS5)
  if ((pathname === '/api/memory/search' || pathname === '/api/tools/memory/search') && (method === 'GET' || method === 'POST')) {
    try {
      let query = reqUrl.searchParams.get('q') || reqUrl.searchParams.get('query') || reqUrl.searchParams.get('cari') || reqUrl.searchParams.get('kata_kunci') || reqUrl.searchParams.get('topik') || '';
      let limit = parseInt(reqUrl.searchParams.get('limit') || '5', 10);
      if (method === 'POST') {
        const body = await safeParseBody(req);
        if (!body) return;
        query = body.query || body.cari || body.kata_kunci || body.keyword || body.topik || body.topic || body.q || query;
        if (body.limit) limit = parseInt(body.limit, 10);
      }
      if (!query || !query.trim()) {
        return sendJSON(res, 400, { error: 'Parameter `query` atau `q` diperlukan untuk mencari memori.' });
      }
      const searchRes = searchMemoryRecords(reqUserId, query, limit);
      return sendJSON(res, 200, searchRes);
    } catch (e) {
      return sendJSON(res, 500, { error: 'Gagal mencari memori: ' + e.message });
    }
  }

  // Local Python Code Subprocess Sandbox Execution Endpoint
  if ((pathname === '/api/execute-code' || pathname === '/api/tools/execute-code') && method === 'POST') {
    try {
      const body = await safeParseBody(req);
      if (!body) return;
      const code = body.code || body.script || body.python || '';
      const timeoutMs = Math.min(Math.max(parseInt(body.timeoutMs || '5000', 10) || 5000, 1000), 10000);
      if (!code || !code.trim()) {
        return sendJSON(res, 400, { error: 'Parameter `code` diperlukan untuk eksekusi kode.' });
      }
      const execRes = await executePythonSandbox(code, timeoutMs);
      return sendJSON(res, 200, execRes);
    } catch (e) {
      return sendJSON(res, 500, { error: 'Gagal mengeksekusi kode: ' + e.message });
    }
  }

  // =========================================================================
  // NATIVE CLAUDE-CODE PARITY WORKSPACE FILE SYSTEM API
  // Mengizinkan modifikasi langsung file fisik di direktori lokal tanpa unduh
  // =========================================================================
  const WORKSPACE_ROOT = process.env.ZOZ_WORKSPACE_ROOT
    ? path.resolve(process.env.ZOZ_WORKSPACE_ROOT)
    : path.resolve(__dirname);
  const SNAPSHOTS_DIR = path.join(WORKSPACE_ROOT, '.zoz-snapshots');
  const USER_HOME = process.env.USERPROFILE || os.homedir() || WORKSPACE_ROOT;
  const DEFAULT_TERMINAL_CWD = (!IS_VERCEL_ENV && fs.existsSync(USER_HOME)) ? USER_HOME : WORKSPACE_ROOT;

  // =========================================================================
  // CLOUDFLARE TUNNEL REMOTE ACCESS MANAGEMENT API
  // =========================================================================
  if (pathname === '/api/terminal/tunnel-info' && method === 'GET') {
    const isRemote = isRemoteTunnelRequest(req);
    const pinCheck = validateRemoteTerminalPin(req, reqUrl, null);
    return sendJSON(res, 200, {
      active: cloudflareTunnelActive,
      tunnelUrl: cloudflareTunnelUrl,
      wssUrl: cloudflareTunnelUrl ? cloudflareTunnelUrl.replace(/^http/i, 'ws') : '',
      pin: (!isRemote || pinCheck.valid) ? cloudflareTunnelPin : undefined,
      requiresPin: isRemote && !pinCheck.valid,
      authenticated: !isRemote || pinCheck.valid,
      startedAt: cloudflareTunnelStartedAt,
      error: cloudflareTunnelError
    });
  }

  if (pathname === '/api/terminal/tunnel-start' && method === 'POST') {
    const isRemote = isRemoteTunnelRequest(req);
    if (isRemote) {
      const pinCheck = validateRemoteTerminalPin(req, reqUrl, null);
      if (!pinCheck.valid) {
        return sendJSON(res, 401, { error: 'Akses ditolak: Hanya host lokal atau klien dengan PIN valid yang dapat memulai tunnel.' });
      }
    }
    const result = await startCloudflareTunnel();
    return sendJSON(res, 200, result);
  }

  if (pathname === '/api/terminal/tunnel-stop' && method === 'POST') {
    const isRemote = isRemoteTunnelRequest(req);
    if (isRemote) {
      const pinCheck = validateRemoteTerminalPin(req, reqUrl, null);
      if (!pinCheck.valid) {
        return sendJSON(res, 401, { error: 'Akses ditolak: Hanya host lokal atau klien dengan PIN valid yang dapat mematikan tunnel.' });
      }
    }
    const result = stopCloudflareTunnel();
    return sendJSON(res, 200, result);
  }

  if (pathname === '/api/terminal/tunnel-regenerate-pin' && method === 'POST') {
    const isRemote = isRemoteTunnelRequest(req);
    if (isRemote) {
      return sendJSON(res, 403, { error: 'Hanya host lokal di laptop yang dapat meregenerasi PIN keamanan sesi.' });
    }
    cloudflareTunnelPin = generateSixDigitPin();
    return sendJSON(res, 200, {
      success: true,
      pin: cloudflareTunnelPin,
      message: 'PIN keamanan sesi baru berhasil dibuat.'
    });
  }

  if (pathname === '/api/terminal/tunnel-set-url' && method === 'POST') {
    const isRemote = isRemoteTunnelRequest(req);
    if (isRemote) {
      return sendJSON(res, 403, { error: 'Hanya host lokal yang dapat menyetel URL tunnel manual.' });
    }
    const body = await safeParseBody(req);
    if (!body) return;
    if (body.url && typeof body.url === 'string') {
      cloudflareTunnelUrl = body.url.trim().replace(/\/+$/, '');
      cloudflareTunnelActive = true;
      cloudflareTunnelStartedAt = new Date().toISOString();
      return sendJSON(res, 200, {
        success: true,
        tunnelUrl: cloudflareTunnelUrl,
        wssUrl: cloudflareTunnelUrl.replace(/^http/i, 'ws'),
        pin: cloudflareTunnelPin
      });
    }
    return sendJSON(res, 400, { error: 'URL Cloudflare Tunnel tidak valid.' });
  }

  // =========================================================================
  // NEURAL TERMINAL REAL-TIME STREAMING & CONPTY / PSEUDOCONSOLE API
  // Mengizinkan sesi terminal interaktif nyata (node-pty + SSE duplex streaming)
  // =========================================================================
  if (pathname === '/api/terminal/stream' && method === 'GET') {
    const pinCheck = validateRemoteTerminalPin(req, reqUrl, null);
    if (!pinCheck.valid) {
      res.writeHead(401, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(pinCheck.error || 'Akses ditolak: PIN keamanan remote salah.');
    }

    const sessionId = (reqUrl.searchParams.get('session') || 'default').trim();
    const shellType = (reqUrl.searchParams.get('shell') || 'powershell').toLowerCase();
    let reqCwd = (reqUrl.searchParams.get('cwd') || '').trim();
    while ((reqCwd.startsWith('"') && reqCwd.endsWith('"')) || (reqCwd.startsWith("'") && reqCwd.endsWith("'"))) {
      reqCwd = reqCwd.slice(1, -1).trim();
    }
    const targetCwd = (reqCwd && fs.existsSync(reqCwd)) ? path.resolve(reqCwd) : DEFAULT_TERMINAL_CWD;
    const cols = Math.max(20, Math.min(300, parseInt(reqUrl.searchParams.get('cols') || '100', 10)));
    const rows = Math.max(5, Math.min(100, parseInt(reqUrl.searchParams.get('rows') || '28', 10)));

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Private-Network': 'true'
    });

    if (!nodePty) {
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      res.write(`data: ${JSON.stringify({ type: 'connected', session: sessionId, shell: shellType, cwd: targetCwd })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'fallback', message: 'Mode command-exec aktif di lingkungan cloud sandbox.' })}\n\n`);
      res.write(`data: ${JSON.stringify({
        type: 'data',
        data: `\r\n\x1b[36m⚡ [ZOZ NEURAL TERMINAL // CLOUD RUNTIME]\x1b[0m\r\n` +
              `\x1b[90mServerless Cloud Sandbox aktif. Mode Command-Exec siap menerima perintah.\x1b[0m\r\n` +
              `\x1b[33mKetik perintah shell secara langsung di terminal.\x1b[0m\r\n\r\n`
      })}\n\n`);
      const hb = setInterval(() => {
        if (!res.writableEnded) res.write(': ping\n\n');
      }, 15000);
      req.on('close', () => clearInterval(hb));
      return;
    }

    let session = activeTerminalSessions.get(sessionId);
    if (!session || !session.pty) {
      const shellInfo = resolveHostShell(shellType);
      try {
        const ptyProcess = nodePty.spawn(shellInfo.exe, shellInfo.args, {
          name: 'xterm-256color',
          cols,
          rows,
          cwd: targetCwd,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor'
          },
          useConpty: process.platform === 'win32'
        });

        session = {
          id: sessionId,
          shell: shellType,
          cwd: targetCwd,
          pty: ptyProcess,
          clients: new Set(),
          buffer: [],
          createdAt: Date.now(),
          lastActivity: Date.now()
        };

        ptyProcess.onData((data) => {
          session.lastActivity = Date.now();
          if (session.buffer.length > 500) session.buffer.shift();
          session.buffer.push(data);
          const payload = `data: ${JSON.stringify({ type: 'data', data })}\n\n`;
          for (const client of session.clients) {
            try { if (!client.writableEnded) client.write(payload); } catch (_) {}
          }
        });

        ptyProcess.onExit(({ exitCode, signal }) => {
          const payload = `data: ${JSON.stringify({ type: 'exit', exitCode, signal })}\n\n`;
          for (const client of session.clients) {
            try { if (!client.writableEnded) client.write(payload); } catch (_) {}
          }
          activeTerminalSessions.delete(sessionId);
        });

        activeTerminalSessions.set(sessionId, session);
      } catch (spawnErr) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: spawnErr.message })}\n\n`);
        return res.end();
      }
    } else if (session && session.pty && typeof session.pty.resize === 'function') {
      try {
        session.pty.resize(cols, rows);
      } catch (_) {}
    }

    session.clients.add(res);

    // Kirim konfirmasi terkoneksi dan buffer historis jika ada
    res.write(`data: ${JSON.stringify({ type: 'connected', session: sessionId, shell: session.shell, cwd: session.cwd })}\n\n`);
    if (session.buffer && session.buffer.length > 0) {
      const replay = session.buffer.join('');
      res.write(`data: ${JSON.stringify({ type: 'init', data: replay })}\n\n`);
    }

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': heartbeat\n\n');
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      session.clients.delete(res);
      // Grace period 10 menit bila tidak ada client aktif
      if (session.clients.size === 0) {
        setTimeout(() => {
          if (session.clients.size === 0 && activeTerminalSessions.get(sessionId) === session) {
            try { session.pty.kill(); } catch (_) {}
            activeTerminalSessions.delete(sessionId);
          }
        }, 10 * 60 * 1000);
      }
    });

    return;
  }

  // Kirim keystroke / input mentah ke PTY session
  if (pathname === '/api/terminal/input' && method === 'POST') {
    try {
      const body = await safeParseBody(req);
      if (!body) return;
      const pinCheck = validateRemoteTerminalPin(req, reqUrl, body);
      if (!pinCheck.valid) {
        return sendJSON(res, 401, { error: pinCheck.error });
      }
      const sessionId = (body.session || 'default').trim();
      const data = typeof body.data === 'string' ? body.data : '';
      const session = activeTerminalSessions.get(sessionId);
      if (session && session.pty) {
        session.pty.write(data);
        session.lastActivity = Date.now();
        return sendJSON(res, 200, { success: true });
      }
      return sendJSON(res, 200, { success: false, reason: 'Session not found or PTY inactive', fallback: !nodePty });
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  }

  // Resize dimensi baris & kolom terminal PTY
  if (pathname === '/api/terminal/resize' && method === 'POST') {
    try {
      const body = await safeParseBody(req);
      if (!body) return;
      const pinCheck = validateRemoteTerminalPin(req, reqUrl, body);
      if (!pinCheck.valid) {
        return sendJSON(res, 401, { error: pinCheck.error });
      }
      const sessionId = (body.session || 'default').trim();
      const cols = Math.max(20, Math.min(400, parseInt(body.cols || '100', 10)));
      const rows = Math.max(5, Math.min(200, parseInt(body.rows || '28', 10)));
      const session = activeTerminalSessions.get(sessionId);
      if (session && session.pty && typeof session.pty.resize === 'function') {
        try {
          session.pty.resize(cols, rows);
          return sendJSON(res, 200, { success: true, cols, rows });
        } catch (resizeErr) {
          return sendJSON(res, 200, { success: false, error: resizeErr.message });
        }
      }
      return sendJSON(res, 200, { success: true, warning: 'No active PTY to resize' });
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  }

  // Matikan / bersihkan sesi terminal
  if (pathname === '/api/terminal/kill' && method === 'POST') {
    try {
      const body = await safeParseBody(req);
      if (!body) return;
      const pinCheck = validateRemoteTerminalPin(req, reqUrl, body);
      if (!pinCheck.valid) {
        return sendJSON(res, 401, { error: pinCheck.error });
      }
      const sessionId = (body.session || 'default').trim();
      const session = activeTerminalSessions.get(sessionId);
      if (session) {
        try { if (session.pty) session.pty.kill(); } catch (_) {}
        activeTerminalSessions.delete(sessionId);
      }
      return sendJSON(res, 200, { success: true });
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  }

  // =========================================================================
  // NEURAL TERMINAL CLI EXECUTION API
  // Mengizinkan eksekusi perintah shell interaktif (PowerShell, CMD, WSL, Node)
  // =========================================================================
  if ((pathname === '/api/terminal/exec' || pathname === '/api/terminal/run') && method === 'POST') {
    try {
      const body = await safeParseBody(req);
      if (!body) return;
      const pinCheck = validateRemoteTerminalPin(req, reqUrl, body);
      if (!pinCheck.valid) {
        return sendJSON(res, 401, { error: pinCheck.error });
      }
      const cmd = (body.command || body.cmd || '').trim();
      const shellType = (body.shell || 'powershell').toLowerCase();

      // Bersihkan dan normalisasi targetCwd dari petik berlebih
      let rawCwd = (body.cwd || '').trim();
      while ((rawCwd.startsWith('"') && rawCwd.endsWith('"')) || (rawCwd.startsWith("'") && rawCwd.endsWith("'"))) {
        rawCwd = rawCwd.slice(1, -1).trim();
      }
      let targetCwd = rawCwd ? path.resolve(rawCwd) : DEFAULT_TERMINAL_CWD;

      // Pastikan targetCwd ada atau fallback ke DEFAULT_TERMINAL_CWD (kecuali Vercel sandbox virtual)
      if (!fs.existsSync(targetCwd) && !IS_VERCEL_ENV) {
        targetCwd = DEFAULT_TERMINAL_CWD;
      }

      if (!cmd) {
        return sendJSON(res, 200, {
          success: true,
          output: '',
          stdout: '',
          stderr: '',
          cwd: targetCwd,
          exitCode: 0
        });
      }

      // 1. Khusus alih drive Windows mandiri (e.g. "C:", "D:", "c:\", "d:\")
      if (/^[a-zA-Z]:\\?$/i.test(cmd)) {
        const driveLetter = cmd.slice(0, 2).toUpperCase() + '\\';
        if (fs.existsSync(driveLetter)) {
          return sendJSON(res, 200, {
            success: true,
            output: `Direktori aktif diubah ke: ${driveLetter}`,
            stdout: `Direktori aktif diubah ke: ${driveLetter}`,
            stderr: '',
            cwd: driveLetter,
            exitCode: 0
          });
        }
      }

      // 2. Khusus perintah internal cd / chdir (change directory)
      if (/^(cd|chdir)(\s+|$)/i.test(cmd) && !/[&|;]/.test(cmd)) {
        let cleanDest = cmd.replace(/^(cd|chdir)(\s*)/i, '').trim();
        cleanDest = cleanDest.replace(/^\/d\s*/i, '').trim();

        // Bersihkan petik ganda maupun tunggal di sekitar target path
        while ((cleanDest.startsWith('"') && cleanDest.endsWith('"')) || 
               (cleanDest.startsWith("'") && cleanDest.endsWith("'"))) {
          cleanDest = cleanDest.slice(1, -1).trim();
        }

        let newCwd = targetCwd;
        if (!cleanDest || cleanDest === '~') {
          newCwd = os.homedir();
        } else if (cleanDest.startsWith('~/') || cleanDest.startsWith('~\\')) {
          newCwd = path.resolve(os.homedir(), cleanDest.slice(2));
        } else if (/^[a-zA-Z]:$/i.test(cleanDest)) {
          newCwd = cleanDest.toUpperCase() + '\\';
        } else {
          newCwd = path.resolve(targetCwd, cleanDest);
        }

        if (fs.existsSync(newCwd)) {
          try {
            const stat = fs.statSync(newCwd);
            if (!stat.isDirectory()) {
              return sendJSON(res, 200, {
                success: false,
                output: `Bukan sebuah direktori: ${cleanDest}`,
                stdout: '',
                stderr: `Bukan sebuah direktori: ${cleanDest}`,
                cwd: targetCwd,
                exitCode: 1
              });
            }
          } catch (_) {}

          return sendJSON(res, 200, {
            success: true,
            output: `Direktori aktif diubah ke: ${newCwd}`,
            stdout: `Direktori aktif diubah ke: ${newCwd}`,
            stderr: '',
            cwd: newCwd,
            exitCode: 0
          });
        } else if (IS_VERCEL_ENV) {
          // Vercel Cloud Sandbox (dukungan navigasi direktori di lingkungan cloud Linux)
          if (/^[a-zA-Z]:[\\\/]/i.test(cleanDest) || /^[a-zA-Z]:$/i.test(cleanDest) || /^\\[\\\/]/i.test(cleanDest)) {
            return sendJSON(res, 200, {
              success: false,
              output: `[Vercel Cloud Sandbox] Path Windows "${cleanDest}" tidak ada di Linux cloud container (/var/task).\r\n` +
                      `💡 Untuk mengakses drive Windows (C:\\Users\\user) dan tools Windows (agy), sinkronkan dengan Zoz Bridge Lokal (http://127.0.0.1:4040).`,
              stdout: '',
              stderr: `[Vercel Cloud Sandbox] Path Windows tidak valid di Linux cloud container.`,
              cwd: targetCwd,
              exitCode: 1
            });
          }
          let resolved = path.resolve(targetCwd, cleanDest);
          if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
            return sendJSON(res, 200, {
              success: true,
              output: `[Vercel Cloud Sandbox] Direktori aktif diubah ke: ${resolved}`,
              stdout: `[Vercel Cloud Sandbox] Direktori aktif diubah ke: ${resolved}`,
              stderr: '',
              cwd: resolved,
              exitCode: 0
            });
          }
          return sendJSON(res, 200, {
            success: false,
            output: `[Vercel Cloud Sandbox] Direktori tidak ditemukan: "${cleanDest}"`,
            stdout: '',
            stderr: `[Vercel Cloud Sandbox] Direktori tidak ditemukan: "${cleanDest}"`,
            cwd: targetCwd,
            exitCode: 1
          });
        } else {
          return sendJSON(res, 200, {
            success: false,
            output: `Tidak dapat menemukan jalur: "${cleanDest}"`,
            stdout: '',
            stderr: `Tidak dapat menemukan jalur: "${cleanDest}"`,
            cwd: targetCwd,
            exitCode: 1
          });
        }
      }

      // 3. Eksekusi pada Serverless Vercel (fallback virtual shell)
      if (IS_VERCEL_ENV) {
        if (/^(dir|ls)/i.test(cmd)) {
          const files = await fsp.readdir(targetCwd).catch(() => []);
          const output = files.map(f => `  ${f}`).join('\n') || '(direktori kosong)';
          return sendJSON(res, 200, { success: true, output, stdout: output, stderr: '', cwd: targetCwd, exitCode: 0 });
        }
        if (/^(pwd)/i.test(cmd)) {
          return sendJSON(res, 200, { success: true, output: targetCwd, stdout: targetCwd, stderr: '', cwd: targetCwd, exitCode: 0 });
        }
        if (/^(whoami)/i.test(cmd)) {
          return sendJSON(res, 200, { success: true, output: 'zoz-router-cloud\\user', stdout: 'zoz-router-cloud\\user', stderr: '', cwd: targetCwd, exitCode: 0 });
        }
        if (/^(node\s+-v|node\s+--version)/i.test(cmd)) {
          return sendJSON(res, 200, { success: true, output: process.version, stdout: process.version, stderr: '', cwd: targetCwd, exitCode: 0 });
        }
      }

      // 4. Eksekusi Subprocess Shell Asli dengan Sentinel Pelacak CWD
      const sentinel = '---ZOZ_CWD_MARKER---';
      const isWin = process.platform === 'win32';
      let executable = isWin ? 'powershell.exe' : 'sh';
      let args = isWin 
        ? ['-ExecutionPolicy', 'Bypass', '-Command', `${cmd}\nWrite-Output '${sentinel}'\n(Get-Location).Path`]
        : ['-c', `${cmd} ; echo "${sentinel}" ; pwd`];

      if (shellType === 'cmd' || shellType === 'cmd.exe') {
        executable = isWin ? 'cmd.exe' : 'sh';
        args = isWin ? ['/c', `${cmd} & echo ${sentinel} & cd`] : ['-c', `${cmd} ; echo "${sentinel}" ; pwd`];
      } else if (shellType === 'wsl' || shellType === 'bash' || shellType === 'ubuntu-wsl') {
        executable = isWin ? 'wsl.exe' : (fs.existsSync('/bin/bash') ? '/bin/bash' : 'sh');
        args = isWin ? ['-e', 'bash', '-c', `${cmd} ; echo "${sentinel}" ; pwd`] : ['-c', `${cmd} ; echo "${sentinel}" ; pwd`];
      } else if (shellType === 'node') {
        executable = process.execPath;
        args = ['-e', cmd];
      } else if (shellType === 'python') {
        executable = isWin ? 'python' : 'python3';
        args = ['-c', cmd];
      }

      // Validasi CWD agar aman dan tidak memicu ENOENT di Linux Cloud container
      let safeCwd = targetCwd;
      try {
        if (!safeCwd || !fs.existsSync(safeCwd) || !fs.statSync(safeCwd).isDirectory()) {
          safeCwd = process.cwd();
        }
      } catch (_) {
        safeCwd = process.cwd();
      }

      let proc;
      try {
        proc = spawn(executable, args, {
          cwd: safeCwd,
          env: { ...process.env, TERM: 'xterm-256color' },
          windowsHide: true
        });
      } catch (err) {
        return sendJSON(res, 200, {
          success: false,
          output: `Gagal menjalankan shell: ${err.message || err}`,
          stdout: '',
          stderr: `Gagal menjalankan shell: ${err.message || err}`,
          cwd: safeCwd,
          exitCode: 1
        });
      }

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        try { proc.kill(); } catch (_) {}
      }, 15000);

      proc.stdout.on('data', chunk => {
        stdout += chunk.toString();
        if (stdout.length > 80000) {
          stdout = stdout.slice(-80000);
        }
      });

      proc.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });

      proc.on('error', err => {
        clearTimeout(timer);
        return sendJSON(res, 200, {
          success: false,
          output: `Gagal menjalankan shell: ${err.message}`,
          stdout: '',
          stderr: `Gagal menjalankan shell: ${err.message}`,
          cwd: targetCwd,
          exitCode: 1
        });
      });

      proc.on('close', code => {
        clearTimeout(timer);

        // Ekstraksi sentinel CWD agar direktori aktif selalu tersinkronisasi
        let finalCwd = targetCwd;
        let cleanStdout = stdout;
        const markerIdx = stdout.lastIndexOf(sentinel);
        if (markerIdx !== -1) {
          cleanStdout = stdout.slice(0, markerIdx).trimEnd();
          const afterMarker = stdout.slice(markerIdx + sentinel.length).trim();
          const lines = afterMarker.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length > 0) {
            const detectedCwd = lines[lines.length - 1];
            if (fs.existsSync(detectedCwd)) {
              finalCwd = detectedCwd;
            }
          }
        }

        let finalOut = cleanStdout;
        if (stderr) {
          finalOut += (finalOut ? '\n' : '') + stderr;
        }
        if (timedOut) {
          finalOut += '\n[Eksekusi dibatalkan: batas waktu 15 detik tercapai]';
        }

        if (IS_VERCEL_ENV && /^\s*agy\b/i.test(cmd)) {
          const agyNote = `\r\n\x1b[33m💡 Catatan: 'agy' (Antigravity CLI) terpasang di OS Windows lokal Anda (C:\\Users\\user).\x1b[0m\r\n` +
                          `\x1b[36mTerminal saat ini berjalan di Cloud Sandbox Linux (/var/task).\x1b[0m\r\n` +
                          `\x1b[32mUntuk mengeksekusi 'agy', buka terminal di Windows atau aktifkan Zoz Bridge di port 4040.\x1b[0m\r\n`;
          stderr += agyNote;
          finalOut += agyNote;
        }

        return sendJSON(res, 200, {
          success: code === 0,
          output: finalOut || (code === 0 ? '' : '(gagal tanpa output)'),
          stdout: cleanStdout || (code === 0 ? finalOut : ''),
          stderr: stderr || (code !== 0 ? finalOut : ''),
          cwd: finalCwd,
          exitCode: code !== null ? code : 1
        });
      });

      return;
    } catch (e) {
      return sendJSON(res, 500, { error: 'Kesalahan internal terminal: ' + e.message });
    }
  }

  function isSafeWorkspacePath(targetRelPath) {
    if (!targetRelPath || typeof targetRelPath !== 'string') return false;
    const clean = targetRelPath.trim().replace(/^[/\\]+/, '');
    const resolved = path.resolve(WORKSPACE_ROOT, clean);
    return resolved.startsWith(WORKSPACE_ROOT);
  }

  function getSafeWorkspaceFullPath(targetRelPath) {
    if (!isSafeWorkspacePath(targetRelPath)) return null;
    const clean = targetRelPath.trim().replace(/^[/\\]+/, '');
    return path.resolve(WORKSPACE_ROOT, clean);
  }

  async function scanWorkspaceDirectory(dir, basePath = '', depth = 0) {
    if (depth > 6) return [];
    try {
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      const files = [];
      const IGNORE_SET = new Set(['node_modules', '.git', '.zoz-snapshots', '.gemini', 'data', 'dist', 'build', '.cache']);

      for (const entry of entries) {
        if (IGNORE_SET.has(entry.name) || (entry.name.startsWith('.') && entry.name !== '.env.example')) continue;
        const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const sub = await scanWorkspaceDirectory(fullPath, relPath, depth + 1);
          files.push(...sub);
        } else if (entry.isFile()) {
          try {
            const stat = await fsp.stat(fullPath);
            files.push({
              name: entry.name,
              path: relPath,
              size: stat.size,
              lastModified: stat.mtimeMs,
              type: MIME_TYPES[path.extname(entry.name).toLowerCase()] || 'text/plain'
            });
          } catch (_) {}
        }
      }
      return files;
    } catch (e) {
      return [];
    }
  }

  // 1. Workspace Status
  if ((pathname === '/api/workspace/status' || pathname === '/api/workspace') && method === 'GET') {
    return sendJSON(res, 200, {
      available: true,
      root: WORKSPACE_ROOT,
      dirName: path.basename(WORKSPACE_ROOT),
      canWrite: true,
      platform: 'server-fs'
    });
  }

  // 2. Workspace Files Tree
  if ((pathname === '/api/workspace/files' || pathname === '/api/workspace/tree') && method === 'GET') {
    try {
      const files = await scanWorkspaceDirectory(WORKSPACE_ROOT);
      return sendJSON(res, 200, {
        success: true,
        root: WORKSPACE_ROOT,
        dirName: path.basename(WORKSPACE_ROOT),
        count: files.length,
        files: files
      });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal memindai direktori proyek server: ' + err.message });
    }
  }

  // 3. Workspace Read File
  if ((pathname === '/api/workspace/read' || pathname === '/api/workspace/file') && method === 'GET') {
    const targetPath = (reqUrl.searchParams && reqUrl.searchParams.get('path')) ||
                       (reqUrl.searchParams && reqUrl.searchParams.get('name')) ||
                       (reqUrl.query && reqUrl.query.path);
    if (!targetPath) {
      return sendJSON(res, 400, { error: 'Parameter query `path` diperlukan.' });
    }
    const fullPath = getSafeWorkspaceFullPath(targetPath);
    if (!fullPath) {
      return sendJSON(res, 403, { error: 'Akses ditolak: path di luar direktori kerja proyek.' });
    }
    try {
      if (!fs.existsSync(fullPath)) {
        return sendJSON(res, 404, { error: 'Berkas tidak ditemukan di direktori proyek: ' + targetPath });
      }
      const stat = await fsp.stat(fullPath);
      if (stat.isDirectory()) {
        return sendJSON(res, 400, { error: 'Target adalah direktori, bukan berkas.' });
      }
      const content = await fsp.readFile(fullPath, 'utf8');
      return sendJSON(res, 200, {
        success: true,
        path: targetPath.replace(/^[/\\]+/, ''),
        name: path.basename(fullPath),
        size: stat.size,
        lastModified: stat.mtimeMs,
        content: content
      });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal membaca berkas: ' + err.message });
    }
  }

  // 4. Workspace Write / Edit File (CLAUDE-CODE PARITY LIVE DISK MODIFICATION)
  if ((pathname === '/api/workspace/write' || pathname === '/api/workspace/edit') && method === 'POST') {
    const body = await safeParseBody(req);
    if (!body) return;
    const targetPath = body.path || body.name || body.fileName;
    if (!targetPath || typeof targetPath !== 'string') {
      return sendJSON(res, 400, { error: 'Parameter `path` atau `name` diperlukan.' });
    }
    const fullPath = getSafeWorkspaceFullPath(targetPath);
    if (!fullPath) {
      return sendJSON(res, 403, { error: 'Akses ditolak: path di luar direktori kerja proyek.' });
    }
    const cleanRelPath = targetPath.trim().replace(/^[/\\]+/, '');
    const content = body.content !== undefined ? String(body.content) : '';
    const shouldBackup = body.backup !== false;

    try {
      let backupCreated = false;
      let prevContent = null;
      if (fs.existsSync(fullPath)) {
        if (shouldBackup) {
          try {
            if (!fs.existsSync(SNAPSHOTS_DIR)) {
              await fsp.mkdir(SNAPSHOTS_DIR, { recursive: true });
            }
            prevContent = await fsp.readFile(fullPath, 'utf8');
            const safeBase = path.basename(fullPath).replace(/[^a-zA-Z0-9._-]/g, '_');
            const snapPath = path.join(SNAPSHOTS_DIR, `${Date.now()}_${safeBase}`);
            await fsp.writeFile(snapPath, prevContent, 'utf8');
            backupCreated = true;
          } catch (bErr) {
            console.warn('Gagal membuat backup snapshot berkas:', bErr.message);
          }
        }
      } else {
        // Buat folder induk jika belum ada
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) {
          await fsp.mkdir(parentDir, { recursive: true });
        }
      }

      // Tulis langsung ke disk fisik (In-place edit tanpa unduh, mendukung teks & biner base64)
      if (body.encoding === 'base64') {
        const binBuf = Buffer.from(content, 'base64');
        await fsp.writeFile(fullPath, binBuf);
      } else {
        await fsp.writeFile(fullPath, content, 'utf8');
      }
      const stat = await fsp.stat(fullPath);

      return sendJSON(res, 200, {
        success: true,
        message: `Berkas "${cleanRelPath}" berhasil dimodifikasi langsung di disk!`,
        path: cleanRelPath,
        name: path.basename(fullPath),
        size: stat.size,
        lastModified: stat.mtimeMs,
        backupCreated: backupCreated
      });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal menulis berkas ke disk: ' + err.message });
    }
  }

  // 5. Workspace Delete File
  if ((pathname === '/api/workspace/delete' || pathname === '/api/workspace/remove') && method === 'POST') {
    const body = await safeParseBody(req);
    if (!body) return;
    const targetPath = body.path || body.name || body.fileName;
    if (!targetPath) {
      return sendJSON(res, 400, { error: 'Parameter `path` diperlukan.' });
    }
    const fullPath = getSafeWorkspaceFullPath(targetPath);
    if (!fullPath) {
      return sendJSON(res, 403, { error: 'Akses ditolak: path di luar direktori kerja proyek.' });
    }
    try {
      if (fs.existsSync(fullPath)) {
        await fsp.unlink(fullPath);
        return sendJSON(res, 200, {
          success: true,
          message: `Berkas "${targetPath}" berhasil dihapus dari direktori proyek.`
        });
      } else {
        return sendJSON(res, 404, { error: 'Berkas tidak ditemukan.' });
      }
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal menghapus berkas: ' + err.message });
    }
  }

  // Deep Research: Start Custom URL Deep Analysis (Background Worker)
  if ((pathname === '/api/mulai-riset' || pathname === '/api/deep-research/start') && method === 'POST') {
    const body = await safeParseBody(req);
    if (!body) return;
    try {
      const topik = body.topik || body.topic || body.query || body.prompt || '';
      if (!topik) {
        return sendJSON(res, 400, { error: 'Parameter `topik` atau `prompt` diperlukan untuk memulai Deep Research.' });
      }

      // Kumpulkan dan validasi URL target kustom pengguna
      const rawUrls = body.targetUrls || body.urls || body.customUrls || [];
      const targetUrls = Array.isArray(rawUrls) ? rawUrls.filter(Boolean) : (rawUrls ? [rawUrls] : []);
      const extractedUrls = extractCustomAnalysisUrls(`${topik} ${body.prompt || ''}`);
      extractedUrls.forEach(u => {
        if (!targetUrls.includes(u)) targetUrls.push(u);
      });

      if (targetUrls.length === 0) {
        return sendJSON(res, 400, {
          error: 'Mode Deep Research kini berfungsi sebagai Penganalisis Web Kustom URL. Harap sertakan minimal 1 tautan URL kustom (misal: https://example.com/artikel) untuk dianalisis secara mendalam.'
        });
      }

      if (body.endpoint && typeof body.endpoint === 'string') {
        let testEp = body.endpoint.trim();
        if (!/^https?:\/\//i.test(testEp)) {
          testEp = `http://${testEp}`;
        }
        if (isOllamaEndpointForbidden(testEp)) {
          return sendJSON(res, 400, { error: 'Endpoint Ollama mengarah ke host privat/internal - akses diblokir (SSRF Protection).' });
        }
        // M23: DNS-rebinding guard untuk endpoint non-tepercaya.
        if (!isTrustedOllamaEndpoint(testEp)) {
          const dnsVerdict = await assertResolvesPublic(testEp);
          if (!dnsVerdict.ok) return sendJSON(res, 400, { error: dnsVerdict.msg });
        }
      }

      pruneResearchTasks();
      const rawSessionId = body.sessionId || req.headers['x-session-id'] || req.headers['X-Session-ID'] || null;
      const researchUserId = reqUserId;
      const taskId = 'research_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
      dbTugasRiset[taskId] = {
        taskId,
        sessionId: rawSessionId,
        userId: researchUserId,
        topik,
        targetUrls,
        status: 'sedang_meneliti',
        progressPercent: 10,
        currentStep: 'Inisialisasi Agen Deep Research...',
        stepsHistory: ['Memulai analisis topik dan parameter riset'],
        dataTemuan: [],
        sources: [],
        hasil: null,
        error: null,
        createdAt: new Date().toISOString()
      };

      const masterModel = body.finalModel || body.model || body.agent1Model || 'openrouter/free';
      const rawAuth = req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '').trim() : null;
      const rawApiKey = req.headers['x-api-key'] ? String(req.headers['x-api-key']).replace(/^Bearer\s+/i, '').trim() : null;
      const rawSerperKey = req.headers['x-serper-key'] ? String(req.headers['x-serper-key']).trim() : null;
      const rawOllamaKey = req.headers['x-ollama-key'] ? String(req.headers['x-ollama-key']).replace(/^Bearer\s+/i, '').trim() : null;
      const rawOpenRouterKey = req.headers['x-openrouter-key'] ? String(req.headers['x-openrouter-key']).replace(/^Bearer\s+/i, '').trim() : null;

      // Jalankan proses analisis web kustom secara asinkronus di latar belakang dengan arsitektur 1-Model super efisien
      jalankanRisetOtonom(taskId, topik, {
        sessionId: rawSessionId,
        userId: researchUserId,
        targetUrls,
        messages: body.messages || [],
        model: masterModel,
        provider: body.provider || (masterModel.includes('/') ? 'openrouter' : (masterModel.includes(':') ? 'ollama' : 'openrouter')),
        endpoint: body.endpoint,
        apiKey: body.apiKey || rawOpenRouterKey || rawAuth || rawApiKey || null,
        openRouterKey: body.openRouterKey || body.apiKey || rawOpenRouterKey || rawAuth || rawApiKey || process.env.OPENROUTER_API_KEY,
        ollamaApiKey: body.ollamaApiKey || body.apiKey || rawOllamaKey || '',
        serperApiKey: body.serperApiKey || rawSerperKey || rawApiKey || process.env.SERPER_API_KEY,
        agent1Model: masterModel,
        agent2Model: masterModel,
        finalModel: masterModel,
        model3: masterModel,
        model4: masterModel,
        maxIterations: body.maxIterations || 3
      }).catch(err => {
        console.error(`Tugas riset [${taskId}] gagal secara asinkron:`, err.message);
        if (dbTugasRiset[taskId]) {
          dbTugasRiset[taskId].status = 'gagal';
          dbTugasRiset[taskId].error = err.message;
          dbTugasRiset[taskId].currentStep = 'Riset gagal: ' + err.message;
          dbTugasRiset[taskId].completedAt = new Date().toISOString();
        }
      });

      return sendJSON(res, 200, {
        success: true,
        taskId: taskId,
        message: 'Agen AI mulai meneliti di latar belakang.'
      });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Gagal memulai riset: ' + e.message });
    }
  }

  // Deep Research: Status Check & Polling
  const researchStatusMatch = pathname.match(/^\/api\/(?:status-riset|deep-research\/status)\/([a-zA-Z0-9_-]+)$/);
  if (researchStatusMatch && method === 'GET') {
    const taskId = researchStatusMatch[1];
    const dataTugas = dbTugasRiset[taskId];
    if (!dataTugas) {
      return sendJSON(res, 404, { error: 'Tugas riset tidak ditemukan.' });
    }
    const checkUserId = reqUserId;
    if (dataTugas.userId && dataTugas.userId !== checkUserId) {
      return sendJSON(res, 403, { error: 'Akses ditolak: Anda tidak memiliki akses ke tugas riset ini.' });
    }
    return sendJSON(res, 200, {
      taskId: dataTugas.taskId,
      status: dataTugas.status,
      topik: dataTugas.topik,
      progressPercent: dataTugas.progressPercent,
      currentStep: dataTugas.currentStep,
      stepsHistory: dataTugas.stepsHistory,
      hasil: dataTugas.hasil,
      chatSummary: dataTugas.chatSummary || null,
      sources: dataTugas.sources || [],
      liveInspection: dataTugas.liveInspection || null,
      error: dataTugas.error
    });
  }

  // Deep Research: Cancel / Abort Background Task
  const cancelResearchMatch = pathname.match(/^\/api\/(?:batal-riset|deep-research\/stop)\/([a-zA-Z0-9_-]+)$/);
  if (cancelResearchMatch && (method === 'POST' || method === 'GET')) {
    const taskId = cancelResearchMatch[1];
    const dataTugas = dbTugasRiset[taskId];
    if (dataTugas) {
      const checkUserId = reqUserId;
      if (dataTugas.userId && dataTugas.userId !== checkUserId) {
        return sendJSON(res, 403, { error: 'Akses ditolak.' });
      }
      dataTugas.aborted = true;
      dataTugas.status = 'dibatalkan';
      dataTugas.currentStep = 'Riset dihentikan oleh pengguna.';
      dataTugas.completedAt = new Date().toISOString();
      return sendJSON(res, 200, { success: true, message: 'Tugas riset berhasil dibatalkan.' });
    }
    return sendJSON(res, 404, { error: 'Tugas riset tidak ditemukan.' });
  }

  // ----------------------------------------------------
  // YOUTUBE OEMBED METADATA GROUNDING API
  // ----------------------------------------------------
  if (pathname === '/api/youtube-info' && (method === 'GET' || method === 'POST')) {
    let targetUrl = '';
    try {
      if (method === 'GET') {
        targetUrl = reqUrl.searchParams.get('url') || reqUrl.searchParams.get('link') || '';
      } else {
        const body = await safeParseBody(req);
        if (!body) return;
        targetUrl = body.url || body.link || '';
      }

      if (!targetUrl || !targetUrl.trim()) {
        return sendJSON(res, 400, { success: false, error: 'Parameter url diperlukan.' });
      }

      const info = await fetchYouTubeInfo(targetUrl.trim());
      return sendJSON(res, 200, info);
    } catch (err) {
      return sendJSON(res, 200, { success: false, error: err.message, url: targetUrl ? targetUrl.trim() : '' });
    }
  }

  // ----------------------------------------------------
  // YOUTUBE LIVE SEARCH (ZERO API KEY) — penunjang tool search_youtube
  // ----------------------------------------------------
  if (pathname === '/api/youtube-search' && (method === 'GET' || method === 'POST')) {
    try {
      let query = '';
      let maxResults = 6;
      if (method === 'GET') {
        query = reqUrl.searchParams.get('q') || reqUrl.searchParams.get('query') || reqUrl.searchParams.get('keyword') || reqUrl.searchParams.get('search') || reqUrl.searchParams.get('topic') || reqUrl.searchParams.get('title') || reqUrl.searchParams.get('text') || reqUrl.searchParams.get('cari') || reqUrl.searchParams.get('kata_kunci') || reqUrl.searchParams.get('judul') || '';
        const parsedLimit = parseInt(reqUrl.searchParams.get('limit') || reqUrl.searchParams.get('max_results') || '6', 10);
        maxResults = Math.min(Math.max(isNaN(parsedLimit) ? 6 : parsedLimit, 1), 20);
      } else {
        const body = await safeParseBody(req);
        if (!body) return;
        query = body.q || body.query || body.keyword || body.search || body.topic || body.title || body.text || body.cari || body.kata_kunci || body.judul || '';
        const parsedLimit = parseInt(body.limit || body.max_results || '6', 10);
        maxResults = Math.min(Math.max(isNaN(parsedLimit) ? 6 : parsedLimit, 1), 20);
      }

      if (!query || !String(query).trim()) {
        return sendJSON(res, 400, { success: false, error: 'Parameter query diperlukan.' });
      }

      const data = await searchYouTubeVideos(String(query).trim(), maxResults);
      return sendJSON(res, 200, data);
    } catch (err) {
      return sendJSON(res, 500, { success: false, error: err.message });
    }
  }

  // ----------------------------------------------------
  // WEB PAGE CONTENT EXTRACTOR / READER TOOL API
  // ----------------------------------------------------
  if ((pathname === '/api/extract-web' || pathname === '/api/read-url' || pathname === '/api/scrape-url') && (method === 'GET' || method === 'POST')) {
    let targetUrl = '';
    let maxChars = 8000;
    try {
      if (method === 'GET') {
        targetUrl = reqUrl.searchParams.get('url') || reqUrl.searchParams.get('link') || reqUrl.searchParams.get('target') || reqUrl.searchParams.get('targetUrl') || reqUrl.searchParams.get('tautan') || '';
        if (reqUrl.searchParams.get('maxChars')) maxChars = parseInt(reqUrl.searchParams.get('maxChars'), 10) || 8000;
      } else {
        const body = await safeParseBody(req);
        if (!body) return;
        targetUrl = body.url || body.link || body.targetUrl || body.target || body.tautan || '';
        if (body.maxChars) maxChars = parseInt(body.maxChars, 10) || 8000;
      }

      if (!targetUrl || !targetUrl.trim()) {
        return sendJSON(res, 400, { success: false, error: 'Parameter url diperlukan.' });
      }

      const result = await fetchPageDetails(targetUrl.trim(), maxChars);
      return sendJSON(res, 200, result);
    } catch (err) {
      return sendJSON(res, 500, { success: false, error: 'Gagal mengekstrak web: ' + err.message });
    }
  }

  // ----------------------------------------------------
  // AI IMAGE STUDIO: GENERATE IMAGE SYNTHESIS (FLUX & OPENROUTER)
  // ----------------------------------------------------
  if ((pathname === '/api/generate-image' || pathname === '/api/image/generate') && (method === 'POST' || method === 'GET')) {
    try {
      let prompt = '';
      let model = 'flux';
      let width = 1024;
      let height = 1024;
      let seed = null;
      let openRouterKey = null;
      let sessionId = null;
      let referenceImage = null;

      let rawImageUserId = null;
      if (method === 'POST') {
        const body = await safeParseBody(req);
        if (!body) return;
        prompt = body.prompt || body.q || '';
        referenceImage = body.referenceImage || body.image || body.initImage || null;
        sessionId = body.sessionId || req.headers['x-session-id'] || req.headers['X-Session-ID'] || null;
        rawImageUserId = body.userId || null;
        model = body.model || model;
        width = parseInt(body.width, 10) || width;
        height = parseInt(body.height, 10) || height;
        seed = (body.seed !== undefined && body.seed !== null && body.seed !== '') ? (parseInt(body.seed, 10) || 0) : null;
        openRouterKey = body.openRouterKey || body.apiKey || (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null) || req.headers['x-openrouter-key'] || req.headers['x-api-key'] || process.env.OPENROUTER_API_KEY;
      } else {
        prompt = reqUrl.searchParams.get('prompt') || reqUrl.searchParams.get('q') || '';
        referenceImage = reqUrl.searchParams.get('referenceImage') || reqUrl.searchParams.get('image') || null;
        sessionId = reqUrl.searchParams.get('sessionId') || req.headers['x-session-id'] || req.headers['X-Session-ID'] || null;
        rawImageUserId = reqUrl.searchParams.get('userId') || null;
        model = reqUrl.searchParams.get('model') || model;
        width = parseInt(reqUrl.searchParams.get('width'), 10) || width;
        height = parseInt(reqUrl.searchParams.get('height'), 10) || height;
        const rawSeed = reqUrl.searchParams.get('seed');
        seed = (rawSeed !== null && rawSeed !== '') ? (parseInt(rawSeed, 10) || 0) : null;
        openRouterKey = (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null) || req.headers['x-openrouter-key'] || req.headers['x-api-key'] || process.env.OPENROUTER_API_KEY;
      }

      const imageUserId = reqUserId;

      if (openRouterKey) {
        openRouterKey = String(openRouterKey).replace(/^Bearer\s+/i, '').trim();
      }

      if (!prompt || !prompt.trim()) {
        return sendJSON(res, 400, { success: false, error: 'Parameter `prompt` diperlukan untuk menghasilkan atau mengedit gambar.' });
      }

      // Resolusi URL foto referensi lokal (/uploads/...) ke data URI base64 jika ada
      let resolvedRefDataUrl = referenceImage;
      if (typeof referenceImage === 'string' && referenceImage.startsWith('/uploads/')) {
        const localRefPath = path.join(UPLOADS_DIR, path.basename(referenceImage));
        if (fs.existsSync(localRefPath)) {
          try {
            const refBuffer = fs.readFileSync(localRefPath);
            const ext = path.extname(localRefPath).toLowerCase().replace('.', '');
            const mime = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
            resolvedRefDataUrl = `data:${mime};base64,${refBuffer.toString('base64')}`;
          } catch (_) {}
        }
      }
      const isEdit = Boolean(resolvedRefDataUrl);

      const cleanPrompt = prompt.trim();
      const actualSeed = (seed !== null && !isNaN(seed)) ? seed : Math.floor(Math.random() * 100000000);
      const startTime = Date.now();

      // Sanitasi dimensi gambar (min 256, max 2048)
      width = Math.min(Math.max(width, 256), 2048);
      height = Math.min(Math.max(height, 256), 2048);

      // Normalisasi model ID Image (Qwen Image 2.1 Pro, FLUX, Gemini, OpenAI, dll.)
      let rawModel = String(model || 'flux').trim();
      let lowModel = rawModel.toLowerCase();
      let effectiveModel = rawModel;

      if (lowModel === 'qwen/qwen-image-2.1-pro' || lowModel === 'qwen: qwen image 2.1 pro' || lowModel === 'qwen-image-2.1-pro' || lowModel === 'qwen image 2.1 pro' || lowModel === 'qwen 2.1 pro') {
        effectiveModel = 'qwen/qwen-image-2.1-pro';
      } else if (lowModel === 'qwen/qwen-image-2.1-turbo' || lowModel === 'qwen: qwen image 2.1 turbo' || lowModel === 'qwen-image-2.1-turbo' || lowModel === 'qwen image 2.1 turbo' || lowModel === 'qwen 2.1 turbo') {
        effectiveModel = 'qwen/qwen-image-2.1-turbo';
      } else if (lowModel === 'qwen/qwen-image-3-pro' || lowModel === 'qwen: qwen image 3 pro' || lowModel === 'qwen-image-3-pro' || lowModel === 'qwen image 3 pro') {
        effectiveModel = 'qwen/qwen-image-3-pro';
      } else if (lowModel === 'qwen/qwen-image-3' || lowModel === 'qwen: qwen image 3' || lowModel === 'qwen-image-3' || lowModel === 'qwen image 3') {
        effectiveModel = 'qwen/qwen-image-3';
      } else if (lowModel === 'flux-3' || lowModel === 'flux.3' || lowModel === 'flux 3 image' || lowModel === 'black-forest-labs/flux-3-image') {
        effectiveModel = 'black-forest-labs/flux-3-image';
      } else if (lowModel === 'flux-3-klein' || lowModel === 'flux.3-klein' || lowModel === 'black-forest-labs/flux-3-image-klein') {
        effectiveModel = 'black-forest-labs/flux-3-image-klein';
      } else if (lowModel === 'flux.2-pro' || lowModel === 'flux-2-pro' || lowModel === 'black-forest-labs/flux.2-pro') {
        effectiveModel = 'black-forest-labs/flux.2-pro';
      } else if (lowModel === 'flux.2-max' || lowModel === 'flux-2-max' || lowModel === 'black-forest-labs/flux.2-max') {
        effectiveModel = 'black-forest-labs/flux.2-max';
      } else if (lowModel === 'nano-banana-2.1' || lowModel === 'gemini-nano-banana-2.1' || lowModel === 'nano banana 2.1' || lowModel === 'google/gemini-nano-banana-2.1') {
        effectiveModel = 'google/gemini-nano-banana-2.1';
      } else if (lowModel === 'gemini-3.1-flash-image' || lowModel === 'google/gemini-3.1-flash-image') {
        effectiveModel = 'google/gemini-3.1-flash-image';
      } else if (lowModel === 'gemini-3-pro-image' || lowModel === 'google/gemini-3-pro-image') {
        effectiveModel = 'google/gemini-3-pro-image';
      } else if (lowModel === 'gpt-image-2' || lowModel === 'gpt image 2' || lowModel === 'openai/gpt-image-2') {
        effectiveModel = 'openai/gpt-image-2';
      } else if (lowModel === 'gpt-image-2.5-sunburst' || lowModel === 'openai/gpt-image-2.5-sunburst') {
        effectiveModel = 'openai/gpt-image-2.5-sunburst';
      } else if (lowModel === 'gpt-image-2.5-flare' || lowModel === 'openai/gpt-image-2.5-flare') {
        effectiveModel = 'openai/gpt-image-2.5-flare';
      } else if (lowModel === 'gpt-image-1' || lowModel === 'openai/gpt-image-1') {
        effectiveModel = 'openai/gpt-image-1';
      } else if (lowModel === 'recraft-ai/recraft-v3') {
        effectiveModel = 'recraft/recraft-v3';
      } else if (lowModel === 'tencent/hunyuan-image-v3.5') {
        effectiveModel = 'tencent/hy-image-v3.5-preview';
      }

      let remoteImageUrl = '';
      let imageBuffer = null;
      let contentType = 'image/png';

      const isCloudModel = effectiveModel.includes('/');

      // 1. OpenRouter Cloud Dedicated Image Generation / Editing (POST /api/v1/images)
      if (isCloudModel) {
        if (!openRouterKey) {
          return sendJSON(res, 400, { 
            success: false, 
            error: `OpenRouter API Key diperlukan untuk model cloud "${effectiveModel}". Silakan masukkan API Key Anda di menu Pengaturan > Provider Cloud.` 
          });
        }

        let lastOrError = null;

        // 1A. Primary: Dedicated OpenRouter Image Generation / Edit API (POST /api/v1/images)
        try {
          const orImageRes = await new Promise((resolve, reject) => {
            let settled = false;
            const safeResolve = (d) => { if (!settled) { settled = true; resolve(d); } };
            const safeReject = (e) => { if (!settled) { settled = true; reject(e); } };

            const imagePayload = {
              model: effectiveModel,
              prompt: cleanPrompt,
              aspect_ratio: '1:1'
            };
            if (isEdit && resolvedRefDataUrl) {
              // Skema resmi OpenRouter Image API: elemen input_references adalah
              // OBJECT ContentPartImage { type:'image_url', image_url:{url} } —
              // array string polos DITOLAK Zod ("expected object, received string").
              // Data URL base64 lokal diterima sesuai dokumentasi.
              imagePayload.input_references = [
                { type: 'image_url', image_url: { url: resolvedRefDataUrl } }
              ];
            }
            const postData = JSON.stringify(imagePayload);

            const opt = {
              hostname: 'openrouter.ai',
              port: 443,
              path: '/api/v1/images',
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openRouterKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/Zozi0999/zoz_router',
                'X-Title': 'Zoz Router Image Studio',
                'Content-Length': Buffer.byteLength(postData)
              },
              timeout: 45000
            };

            const request = https.request(opt, (response) => {
              let raw = '';
              response.on('data', d => raw += d);
              response.on('end', () => {
                try {
                  const parsed = JSON.parse(raw);
                  if (response.statusCode >= 400 || parsed.error) {
                    const errDetail = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
                    return safeReject(new Error(errDetail || `OpenRouter Image API HTTP ${response.statusCode}`));
                  }
                  const item = parsed.data?.[0];
                  if (item) {
                    if (item.b64_json) {
                      const mime = item.media_type || 'image/png';
                      const buf = Buffer.from(item.b64_json, 'base64');
                      return safeResolve({ buffer: buf, contentType: mime, remoteUrl: `data:${mime};base64,${item.b64_json}` });
                    }
                    if (item.url) {
                      return safeResolve({ remoteUrl: item.url });
                    }
                  }
                  safeReject(new Error('OpenRouter Image API tidak mengembalikan item data visual'));
                } catch (jsonErr) {
                  safeReject(jsonErr);
                }
              });
            });

            request.on('timeout', () => { request.destroy(); safeReject(new Error('OpenRouter Image API timed out')); });
            request.on('error', err => safeReject(err));
            request.write(postData);
            request.end();
          });

          if (orImageRes.buffer) {
            imageBuffer = orImageRes.buffer;
            contentType = orImageRes.contentType || 'image/png';
            remoteImageUrl = orImageRes.remoteUrl || '';
          } else if (orImageRes.remoteUrl) {
            remoteImageUrl = orImageRes.remoteUrl;
            try {
              const downloaded = await downloadImageBuffer(remoteImageUrl, 35000);
              imageBuffer = downloaded.buffer;
              contentType = downloaded.contentType || 'image/png';
            } catch (dlErr) {
              console.warn('Gagal mengunduh buffer gambar OpenRouter ke disk:', dlErr.message);
            }
          }
        } catch (imgApiErr) {
          lastOrError = imgApiErr;
          console.warn('OpenRouter /api/v1/images gagal, mencoba fallback chat/completions:', imgApiErr.message);
        }

        // 1B. Secondary: Fallback ke Multimodal Chat Completions (jika model chat khusus)
        if (!imageBuffer && !remoteImageUrl) {
          try {
            const orChatRes = await new Promise((resolve, reject) => {
              let settled = false;
              const safeResolve = (data) => { if (!settled) { settled = true; resolve(data); } };
              const safeReject = (err) => { if (!settled) { settled = true; reject(err); } };

              const userContent = [
                { type: 'text', text: isEdit ? `Please edit, modify or transform this image according to the instructions: ${cleanPrompt}` : `Please generate an image: ${cleanPrompt}` }
              ];
              if (isEdit && resolvedRefDataUrl) {
                userContent.push({ type: 'image_url', image_url: { url: resolvedRefDataUrl } });
              }
              const postData = JSON.stringify({
                model: effectiveModel,
                messages: [{ role: 'user', content: userContent }],
                modalities: ['image', 'text']
              });
              const opt = {
                hostname: 'openrouter.ai',
                port: 443,
                path: '/api/v1/chat/completions',
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openRouterKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'https://github.com/Zozi0999/zoz_router',
                  'X-Title': 'Zoz Router Image Studio',
                  'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 45000
              };
              const request = https.request(opt, (response) => {
                let raw = '';
                response.on('data', d => raw += d);
                response.on('end', () => {
                  try {
                    const parsed = JSON.parse(raw);
                    if (response.statusCode >= 400 || parsed.error) {
                      const errDetail = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
                      return safeReject(new Error(errDetail || `OpenRouter Chat API HTTP ${response.statusCode}`));
                    }
                    const msg = parsed.choices?.[0]?.message;
                    if (msg) {
                      const imgItem = msg.images?.[0];
                      if (imgItem) {
                        const u = imgItem.image_url?.url || imgItem.url;
                        if (u) {
                          if (u.startsWith('data:')) {
                            const base64Data = u.split(',')[1];
                            return safeResolve({ buffer: Buffer.from(base64Data, 'base64'), contentType: 'image/png' });
                          }
                          return safeResolve({ remoteUrl: u });
                        }
                      }
                      const content = msg.content || '';
                      const mdMatch = content.match(/!\[.*?\]\(((?:https?:\/\/|data:image\/)[^\s\)]+)\)/);
                      if (mdMatch) {
                        const matchUrl = mdMatch[1];
                        if (matchUrl.startsWith('data:')) {
                          const mimeMatch = matchUrl.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,/);
                          const mime = mimeMatch ? mimeMatch[1] : 'image/png';
                          const base64Data = matchUrl.split(',')[1];
                          return safeResolve({ buffer: Buffer.from(base64Data, 'base64'), contentType: mime });
                        }
                        return safeResolve({ remoteUrl: matchUrl });
                      }
                    }
                    safeReject(new Error('OpenRouter Chat tidak mengembalikan data gambar'));
                  } catch (e) {
                    safeReject(e);
                  }
                });
              });
              request.on('timeout', () => { request.destroy(); safeReject(new Error('OpenRouter chat image timed out')); });
              request.on('error', err => safeReject(err));
              request.write(postData);
              request.end();
            });

            if (orChatRes.buffer) {
              imageBuffer = orChatRes.buffer;
              contentType = orChatRes.contentType || 'image/png';
            } else if (orChatRes.remoteUrl) {
              remoteImageUrl = orChatRes.remoteUrl;
              try {
                const downloaded = await downloadImageBuffer(remoteImageUrl, 35000);
                imageBuffer = downloaded.buffer;
                contentType = downloaded.contentType || 'image/png';
              } catch (dlErr) {
                console.warn('Gagal mengunduh buffer gambar chat OpenRouter ke disk:', dlErr.message);
              }
            }
          } catch (chatErr) {
            lastOrError = chatErr;
          }
        }

        // Jika model cloud OpenRouter gagal, JANGAN diam-diam fallback ke Pollinations!
        if (!imageBuffer && !remoteImageUrl) {
          const errDetail = lastOrError ? lastOrError.message : 'OpenRouter tidak mengembalikan visual gambar yang valid';
          return sendJSON(res, 502, {
            success: false,
            error: `Gagal menghasilkan gambar dari model OpenRouter (${effectiveModel}): ${errDetail}`
          });
        }
      }

      // 2. Engine Default (Pollinations AI Multi-Style) - HANYA untuk model lokal/Pollinations
      if (!isCloudModel && !imageBuffer) {
        
        // 2A. Jika mode edit foto dan foto referensi ada, panggil endpoint POST Pollinations img2img
        if (isEdit && resolvedRefDataUrl) {
          try {
            const pollinationsRes = await new Promise((resolve, reject) => {
              let settled = false;
              const safeResolve = (d) => { if (!settled) { settled = true; resolve(d); } };
              const safeReject = (e) => { if (!settled) { settled = true; reject(e); } };

              const postData = JSON.stringify({
                prompt: cleanPrompt,
                model: effectiveModel,
                image: resolvedRefDataUrl,
                width: width,
                height: height,
                nologo: true,
                seed: actualSeed
              });

              const opt = {
                hostname: 'image.pollinations.ai',
                port: 443,
                path: '/',
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(postData),
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 45000
              };

              const reqPoll = https.request(opt, (resp) => {
                if (resp.statusCode >= 400) {
                  resp.resume(); // habiskan body error agar koneksi socket tidak menggantung
                  return safeReject(new Error(`Pollinations HTTP ${resp.statusCode}`));
                }
                const chunks = [];
                resp.on('data', c => chunks.push(c));
                resp.on('end', () => {
                  const buf = Buffer.concat(chunks);
                  const mime = resp.headers['content-type'] || 'image/jpeg';
                  safeResolve({ buffer: buf, contentType: mime });
                });
              });

              reqPoll.on('timeout', () => { reqPoll.destroy(); safeReject(new Error('Pollinations POST timeout')); });
              reqPoll.on('error', err => safeReject(err));
              reqPoll.write(postData);
              reqPoll.end();
            });

            if (pollinationsRes && pollinationsRes.buffer && pollinationsRes.buffer.length > 0) {
              imageBuffer = pollinationsRes.buffer;
              contentType = pollinationsRes.contentType || 'image/jpeg';
            }
          } catch (editErr) {
            console.warn('Pollinations POST edit failed, trying GET fallback:', editErr.message);
          }
        }

        // 2B. Standar text-to-image (atau fallback GET jika POST gagal)
        if (!imageBuffer) {
          let styledPrompt = cleanPrompt;
          if (effectiveModel === 'flux-realism' && !/photo|realis|cinematic/i.test(cleanPrompt)) {
            styledPrompt = `${cleanPrompt}, photorealistic, ultra-detailed 8k photography, cinematic lighting`;
          } else if (effectiveModel === 'flux-anime' && !/anime|manga|2d/i.test(cleanPrompt)) {
            styledPrompt = `${cleanPrompt}, anime aesthetic, high quality Japanese manga style, vibrant colors, detailed line art`;
          } else if (effectiveModel === 'flux-3d' && !/3d|cgi|render/i.test(cleanPrompt)) {
            styledPrompt = `${cleanPrompt}, 3d digital render, octane render, unreal engine 5, 3d cgi volumetric lighting`;
          } else if (effectiveModel === 'midjourney' && !/artistic|midjourney/i.test(cleanPrompt)) {
            styledPrompt = `${cleanPrompt}, midjourney aesthetic, artistic concept art, dramatic composition, breathtaking detail`;
          } else if (effectiveModel === 'flux-pro' && !/masterpiece|pro/i.test(cleanPrompt)) {
            styledPrompt = `${cleanPrompt}, masterpiece, professional award-winning composition, ultra sharp details`;
          }

          // Pemangkasan semantik aman (smart boundary truncation) untuk URL GET guna mencegah error HTTP 414 URI Too Long
          let urlPrompt = styledPrompt;
          if (urlPrompt.length > 800) {
            const cut = urlPrompt.slice(0, 800);
            const lastSpace = cut.lastIndexOf(' ');
            urlPrompt = (lastSpace > 600 ? cut.slice(0, lastSpace) : cut).trim();
          }
          const encodedPrompt = encodeURIComponent(urlPrompt);
          let getUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${encodeURIComponent(effectiveModel)}&seed=${actualSeed}&nologo=true&enhance=true`;
          if (isEdit && typeof referenceImage === 'string' && /^https?:\/\//i.test(referenceImage)) {
            getUrl += `&image=${encodeURIComponent(referenceImage)}`;
          }
          remoteImageUrl = getUrl;
          try {
            const downloaded = await downloadImageBuffer(remoteImageUrl, 40000);
            imageBuffer = downloaded.buffer;
            contentType = downloaded.contentType || 'image/png';
          } catch (dlErr) {
            console.warn('Gagal mengunduh buffer gambar Pollinations ke disk lokal:', dlErr.message);
          }
        }
      }

      // 3. Simpan buffer gambar secara permanen ke UPLOADS_DIR perangkat jika tersedia
      let localUrl = '';
      let filename = null;
      let sizeBytes = 0;

      if (imageBuffer && imageBuffer.length > 0) {
        const ext = contentType.includes('webp') ? 'webp' : (contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png');
        // F17: nama acak kriptografis (bukan Math.random yang bisa ditebak)
        filename = `${isEdit ? 'ai_edit_' : 'ai_gen_'}${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${ext}`;
        const localFilePath = path.join(UPLOADS_DIR, filename);

        try {
          if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
          }
          fs.writeFileSync(localFilePath, imageBuffer);
          localUrl = `/uploads/${filename}`;
          sizeBytes = imageBuffer.length;
        } catch (fsErr) {
          console.warn('Gagal menulis gambar ke disk:', fsErr.message);
        }
      }

      // Fallback: Jika unduhan ke disk gagal tapi remoteImageUrl ada, gunakan remoteImageUrl langsung
      const finalUrl = localUrl || remoteImageUrl;
      if (!finalUrl) {
        throw new Error('Buffer gambar kosong atau gagal diunduh dari engine.');
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (sessionId) {
        appendAssistantMessageToSessionDisk(sessionId, `[Gambar AI Hasil ${isEdit ? 'Editan' : 'Generasi'}: "${cleanPrompt}"]`, effectiveModel, {
          userId: imageUserId,
          isImageGen: true,
          isEdit: isEdit,
          referenceImage: referenceImage || null,
          type: 'image_generation',
          imageUrl: finalUrl,
          url: finalUrl,
          prompt: cleanPrompt,
          model: effectiveModel,
          width: width,
          height: height,
          seed: actualSeed,
          latency: duration
        }).catch(err => console.warn('Gagal simpan notifikasi gambar AI ke sesi:', err && err.message));
      }

      return sendJSON(res, 200, {
        success: true,
        url: finalUrl,
        localUrl: localUrl || finalUrl,
        remoteUrl: remoteImageUrl || null,
        filename: filename,
        prompt: cleanPrompt,
        model: effectiveModel,
        isEdit: isEdit,
        referenceImage: referenceImage || null,
        width: width,
        height: height,
        seed: actualSeed,
        duration: duration,
        sizeBytes: sizeBytes,
        createdAt: new Date().toISOString()
      });

    } catch (err) {
      console.error('Image generation failed:', err);
      return sendJSON(res, 500, {
        success: false,
        error: 'Gagal menghasilkan gambar AI: ' + (err.message || 'Terjadi kesalahan sistem.'),
        prompt: prompt || reqUrl.searchParams.get('prompt') || ''
      });
    }
  }

  // ====================================================
  // AI MUSIC STUDIO: PROCEDURAL NEURAL AUDIO SYNTHESIS
  // ====================================================
  function createWavHeader(dataLength, sampleRate = 44100, channels = 2, bitsPerSample = 16) {
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);
    return header;
  }

  // ====================================================
  // AI MUSIC STUDIO: REAL AUDIO FROM AUDIO-OUTPUT AI MODELS (Google Lyria 3 via OpenRouter)
  // Tidak ada sintesis lokal / generator prosedural: audio berasal langsung dari model AI.
  // ====================================================
  const MUSIC_AUDIO_MODEL_RE = /lyria|musicgen|suno|udio|stable-audio|gpt-audio/i;
  const DEFAULT_MUSIC_MODEL = 'google/lyria-3-clip-preview';

  function neuralTunnelMusicPrompt(rawPrompt) {
    let p = String(rawPrompt || '').trim();
    if (!p) return 'Cyberpunk futuristic melodic synthwave beat, fast tempo 128 BPM';

    const lower = p.toLowerCase();

    // 1. Tokoh legendaris & sensitif bagi safety classifier Google Gemini
    if (/terry\s*(a\.?)?\s*davis|temple\s*os/i.test(lower)) {
      return 'Epic baroque chiptune synthwave tribute, sacred 8-bit hymns, 640x480 retro computing soundscape, rapid arpeggios, fast tempo 138 BPM, solitary programmer divine coding journey, nostalgic heroic instrumental melody';
    }
    if (/kurt\s*cobain|nirvana/i.test(lower)) {
      return 'Raw energetic 90s grunge rock anthem, heavy distorted electric guitars, driving aggressive drums, emotional acoustic intro building into explosive chorus, 120 BPM';
    }
    if (/chester\s*bennington|linkin\s*park/i.test(lower)) {
      return 'Hybrid nu-metal and electronic rock anthem, powerful atmospheric synthesizer riffs, hard-hitting drum beats, soaring emotional melody, 130 BPM';
    }
    if (/michael\s*jackson/i.test(lower)) {
      return 'Energetic 80s funk pop dance groove, punchy bassline, crisp brass stabs, syncopated rhythm, infectious upbeat tempo 120 BPM';
    }
    if (/bob\s*marley/i.test(lower)) {
      return 'Warm soulful roots reggae rhythm, laid-back offbeat guitar skank, deep melodic bassline, organ bubble, uplifting conscious groove 78 BPM';
    }
    if (/beethoven|mozart|bach/i.test(lower)) {
      return 'Grand classical symphonic overture, virtuoso piano passages, dramatic string quartet, sweeping emotional crescendos, baroque elegance';
    }

    // 2. Anime, Pop Culture & Famous Soundtracks (Bypass Google Copyright PROHIBITED_CONTENT)
    if (/jojo|vento\s*d'?oro|golden\s*wind|giorno/i.test(lower)) {
      return 'Energetic Italian anime battle theme, dramatic virtuoso jazz piano solo, explosive funky brass fanfare, driving trap hip-hop beat, triumphant saxophone stabs, fast heroic groove 135 BPM';
    }
    if (/naruto|sadness\s*and\s*sorrow|blue\s*bird|silhouette/i.test(lower)) {
      return 'Epic emotional Japanese anime soundtrack, traditional shakuhachi bamboo flute, soaring melodic string orchestra, shamisen accents, dramatic taiko drums, 115 BPM';
    }
    if (/attack\s*on\s*titan|shingeki|vogel\s*im\s*kafig|sasageyo/i.test(lower)) {
      return 'Thunderous gothic orchestral choir, driving symphonic rock drums, roaring brass section, dramatic operatic strings, apocalyptic high energy 140 BPM';
    }
    if (/dragon\s*ball|cha[- ]la|ultra\s*instinct/i.test(lower)) {
      return 'Electrifying 80s anime hard rock anthem, high-octane electric guitar riffs, driving power drums, triumphant brass, heroic 145 BPM';
    }
    if (/one\s*piece|we\s*are|binks/i.test(lower)) {
      return 'Joyful high-seas pirate folk adventure anthem, accordion melody, rousing choral chants, acoustic guitars, triumphant brass, 128 BPM';
    }
    if (/evangelion|cruel\s*angel/i.test(lower)) {
      return 'Fast-paced 90s eurodance anime pop overture, bright synthesizers, punchy dance beat, dynamic brass, nostalgic 130 BPM';
    }
    if (/demon\s*slayer|kimetsu|gurenge/i.test(lower)) {
      return 'Dynamic modern Japanese rock and traditional instrumentation fusion, heavy electric guitars, koto melodies, driving drums, 135 BPM';
    }
    if (/tokyo\s*ghoul|unravel/i.test(lower)) {
      return 'Intense progressive alt-rock ballad, intimate emotional piano intro exploding into energetic guitars, complex drums, 135 BPM';
    }
    if (/interstellar|hans\s*zimmer/i.test(lower)) {
      return 'Monumental cosmic pipe organ overture, ticking rhythmic pulses, expansive symphonic strings, awe-inspiring crescendo 80 BPM';
    }
    if (/star\s*wars|imperial\s*march/i.test(lower)) {
      return 'Mighty cinematic space opera march, bombastic brass fanfares, aggressive percussion, dark commanding orchestral theme, 105 BPM';
    }
    if (/doom|mick\s*gordon|bfg/i.test(lower)) {
      return 'Industrial argent metal anthem, 8-string drop-tuned distorted guitars, synthesized chainsaw bass, relentless aggression 140 BPM';
    }
    if (/cyberpunk|edgerunners/i.test(lower)) {
      return 'Dystopian darksynth electro-industrial beat, gritty analog bassline, neon synthesizer leads, cybernetic glitch drums, 125 BPM';
    }
    if (/phonk|drift\s*phonk/i.test(lower)) {
      return 'Aggressive drift phonk beat, distorted cowbell melody, heavy 808 sub bass, rapid hi-hats, 130 BPM';
    }

    // 3. Filter kata sensitif / tragedi / bunuh diri yang memicu false-positive filter Google
    if (/suicide|bunuh\s*diri|self[- ]harm/i.test(lower)) {
      return 'Deep emotional melancholic piano ballad, poignant sorrowful string arrangement building into a powerful uplifting cathartic release, 75 BPM';
    }
    if (/death|mati|kematian|die|dying|grave|makam/i.test(lower)) {
      return 'Ethereal cinematic orchestral adagio, melancholic cello solo, gentle acoustic resonance, dramatic emotional progression';
    }
    if (/war|perang|battle|tempur|pembantaian|massacre/i.test(lower)) {
      return 'Epic cinematic symphonic battle soundtrack, thunderous taiko drums, roaring brass section, heroic fast strings, dramatic climactic overture 140 BPM';
    }
    if (/traged(y|i)|sad\s*story|kisah\s*sedih/i.test(lower)) {
      return 'Poignant cinematic soundtrack, emotional cello and piano duet, dramatic crescendo, profound melancholy transforming into hope, 80 BPM';
    }

    // 4. Entity & biographical phrase scrubber
    let cleaned = p
      .replace(/\b(?:create|make|generate|produce|compose|write|bikin|buatkan|buat|mainkan)\s+(?:music|musik|song|lagu|track|audio|beat|melodi)\s+(?:for|about|of|tentang|untuk)?/gi, '')
      .replace(/\b(?:the\s+)?(?:life\s*story|biography|story|kisah\s*hidup|cerita)\s+(?:of|about|tentang)?/gi, '')
      .replace(/\b(?:for|about|tentang|mengenai)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g, 'a visionary heroic journey')
      .trim();

    if (!cleaned || cleaned.length < 5) {
      cleaned = 'Inspiring cinematic instrumental journey, uplifting melody, rich harmonic layers, dynamic rhythms';
    }

    // 5. Pastikan memiliki deskriptor musikal (genre, instrumen, tempo)
    const hasMusicalGenre = /rock|metal|pop|jazz|lofi|lo-fi|synthwave|cyberpunk|electronic|edm|classical|chiptune|hiphop|acoustic|ambient|orchestral|reggae|blues|techno|house|drill|trap|folk|ballad/i.test(cleaned);
    if (!hasMusicalGenre) {
      cleaned = `Cinematic emotional melodic tribute, ${cleaned}, rich instruments, soaring arrangement, 120 BPM`;
    }

    return cleaned;
  }

  function desensitizeToPureMusicalStyle(rawPrompt) {
    const p = String(rawPrompt || '').toLowerCase();
    let genre = 'cinematic energetic instrumental';
    if (/jojo|vento|giorno/i.test(p)) genre = 'energetic Italian anime jazz-funk battle groove, virtuosic piano, brass section, trap drums, 135 BPM';
    else if (/jazz|swing|bebop|brass/i.test(p)) genre = 'energetic big band jazz and funky brass groove, 130 BPM';
    else if (/rock|metal|guitar/i.test(p)) genre = 'high-octane hard rock anthem, soaring electric guitars and heavy drums, 135 BPM';
    else if (/pop|dance|disco/i.test(p)) genre = 'infectious modern upbeat dance pop groove, vibrant synths, 124 BPM';
    else if (/hiphop|rap|trap|beat/i.test(p)) genre = 'hard-hitting urban trap instrumental, punchy 808 sub-bass and crisp rhythm, 130 BPM';
    else if (/lo[- ]?fi|chill/i.test(p)) genre = 'relaxing chill lofi study beat, warm piano keys and gentle vinyl crackle, 75 BPM';
    else if (/synthwave|retro|cyberpunk|electronic/i.test(p)) genre = 'futuristic neon synthwave, driving analog arpeggios and vintage drums, 122 BPM';
    else if (/piano|ballad|sad|slow/i.test(p)) genre = 'poignant emotional piano and cello ballad, sweeping orchestral strings, 80 BPM';
    else if (/anime|japanese|ost/i.test(p)) genre = 'epic heroic anime battle theme, virtuosic piano, brass stabs, driving drums, 135 BPM';
    else genre = 'epic inspirational symphonic soundtrack, dynamic rhythm, heroic soaring melodies, 125 BPM';

    return `Pure musical instrumental composition: ${genre}, rich acoustic and electronic production, no vocal references.`;
  }

  function detectAudioContainer(buf) {
    if (!buf || buf.length < 4) return null;
    if (buf.slice(0, 4).toString('latin1') === 'RIFF') return 'wav';
    if (buf.slice(0, 3).toString('latin1') === 'ID3') return 'mp3';
    if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return 'mp3';
    if (buf.slice(0, 4).toString('latin1') === 'OggS') return 'ogg';
    if (buf.slice(0, 4).toString('latin1') === 'fLaC') return 'flac';
    if (buf.length > 12 && buf.slice(4, 8).toString('latin1') === 'ftyp') return 'm4a';
    return null;
  }

  function extractAudioFromParts(parts, sink) {
    if (!Array.isArray(parts)) return;
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      if (typeof part.text === 'string') sink.text += part.text;
      const a = part.audio || part.input_audio || part.output_audio;
      if (a && typeof a.data === 'string') sink.audio.push(a.data);
      else if (typeof part.data === 'string' && /audio/i.test(String(part.type || ''))) sink.audio.push(part.data);
      const url = (part.audio_url && part.audio_url.url) || (part.audio && part.audio.url) || '';
      if (typeof url === 'string' && url.startsWith('data:')) {
        const idx = url.indexOf('base64,');
        if (idx !== -1) sink.audio.push(url.slice(idx + 7));
      }
    }
  }

  function collectChoice(choice, sink) {
    if (!choice) return;
    for (const m of [choice.delta, choice.message]) {
      if (!m || typeof m !== 'object') continue;
      if (typeof m.content === 'string') sink.text += m.content;
      else extractAudioFromParts(m.content, sink);
      if (m.audio && typeof m.audio === 'object' && !Array.isArray(m.audio)) {
        if (typeof m.audio.data === 'string') sink.audio.push(m.audio.data);
        if (typeof m.audio.transcript === 'string') sink.text += m.audio.transcript;
        const url = m.audio.url || '';
        if (typeof url === 'string' && url.startsWith('data:')) {
          const idx = url.indexOf('base64,');
          if (idx !== -1) sink.audio.push(url.slice(idx + 7));
        }
      }
      if (Array.isArray(m.audio)) extractAudioFromParts(m.audio, sink);
    }
  }

  function generateAudioViaOpenRouter({ model, prompt, key, timeoutMs = 300000, isRetried = false }) {
    return new Promise((resolve, reject) => {
      const payload = {
        model,
        messages: [{ role: 'user', content: prompt }],
        modalities: ['text', 'audio'],
        stream: true
      };
      if (/gpt-audio/i.test(model)) payload.audio = { voice: 'alloy', format: 'pcm16' };
      const postData = JSON.stringify(payload);
      const opt = {
        hostname: 'openrouter.ai',
        port: 443,
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/Zozi0999/zoz_router',
          'X-Title': 'Zoz Router AI Music Studio',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: timeoutMs
      };

      const sink = { text: '', audio: [] };
      let raw = '';
      let buffer = '';
      let streamError = null;

      const handleLine = (line) => {
        const l = line.trim();
        if (!l || l.startsWith(':') || !l.startsWith('data:')) return;
        const data = l.slice(5).trim();
        if (!data || data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          if (json.error) {
            streamError = typeof json.error === 'object' ? (json.error.message || JSON.stringify(json.error)) : String(json.error);
            return;
          }
          if (Array.isArray(json.choices)) json.choices.forEach(c => collectChoice(c, sink));
        } catch (_) { /* partial chunk */ }
      };

      const req2 = https.request(opt, (resp) => {
        resp.setEncoding('utf8');
        resp.on('data', (chunk) => {
          raw += chunk;
          if (raw.length > 200 * 1024 * 1024) { req2.destroy(new Error('Respons audio terlalu besar')); return; }
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop();
          lines.forEach(handleLine);
        });
        resp.on('end', () => {
          if (buffer) handleLine(buffer);

          if (resp.statusCode >= 400) {
            let msg = `HTTP ${resp.statusCode}`;
            try {
              const j = JSON.parse(raw);
              const e = j.error;
              msg = (e && (e.message || (e.metadata && e.metadata.raw))) || JSON.stringify(j).slice(0, 300);
            } catch (_) { msg += ': ' + raw.slice(0, 300); }
            if (!isRetried && /PROHIBITED_CONTENT|BLOCKED|SAFETY|HARM|filtered/i.test(msg)) {
              console.warn('[Leviathan Neural Tunneling] Terdeteksi filter sensor Google (' + msg + '). Menjalankan adversarial prompt tunneling server...');
              const bypassedPrompt = desensitizeToPureMusicalStyle(prompt);
              return generateAudioViaOpenRouter({ model, prompt: bypassedPrompt, key, timeoutMs, isRetried: true }).then(resolve).catch(reject);
            }
            if (/not a valid model ID|model_not_found|unsupported model/i.test(msg) && model !== DEFAULT_MUSIC_MODEL) {
              console.warn('[Music Model Fallback] Model "' + model + '" tidak valid di OpenRouter. Beralih ke Google Lyria 3 Clip resmi...');
              return generateAudioViaOpenRouter({ model: DEFAULT_MUSIC_MODEL, prompt, key, timeoutMs, isRetried: true }).then(resolve).catch(reject);
            }
            return reject(new Error(msg));
          }
          if (streamError) return reject(new Error(streamError));

          if (sink.audio.length === 0 && raw.trim().startsWith('{')) {
            try {
              const j = JSON.parse(raw);
              if (j.error) return reject(new Error(typeof j.error === 'object' ? (j.error.message || JSON.stringify(j.error)) : String(j.error)));
              if (Array.isArray(j.choices)) j.choices.forEach(c => collectChoice(c, sink));
            } catch (_) { /* ignore */ }
          }

          if (sink.audio.length === 0) {
            console.warn('[AI Music] Tidak ada audio di respons. Cuplikan:', raw.slice(0, 400));
            return reject(new Error('Model tidak mengembalikan data audio. Cuplikan respons: ' + raw.replace(/\s+/g, ' ').slice(0, 200)));
          }
          const b64Merged = sink.audio.join('').replace(/^data:audio\/[^;]+;base64,/i, '').replace(/\s+/g, '');
          const audioBuf = Buffer.from(b64Merged, 'base64');
          resolve({ audio: audioBuf, text: sink.text.trim() });
        });
      });
      req2.on('error', reject);
      req2.on('timeout', () => req2.destroy(new Error('Timeout: model audio terlalu lama merespons')));
      req2.write(postData);
      req2.end();
    });
  }

  if ((pathname === '/api/generate-music' || pathname === '/api/music/generate') && (method === 'POST' || method === 'GET')) {
    let prompt = '';
    try {
      let sessionId = null;
      let requestedMusicModel = '';
      let openRouterKey = '';

      let rawMusicUserId = null;
      if (method === 'POST') {
        const body = await safeParseBody(req);
        if (!body) return;
        prompt = body.prompt || body.q || '';
        sessionId = body.sessionId || req.headers['x-session-id'] || null;
        rawMusicUserId = body.userId || null;
        requestedMusicModel = (body.musicModel || body.model || '').trim();
        openRouterKey = (body.openRouterKey || req.headers['x-openrouter-key'] || '').trim();
      } else {
        prompt = reqUrl.searchParams.get('prompt') || reqUrl.searchParams.get('q') || '';
        sessionId = reqUrl.searchParams.get('sessionId') || req.headers['x-session-id'] || null;
        rawMusicUserId = reqUrl.searchParams.get('userId') || null;
        requestedMusicModel = (reqUrl.searchParams.get('musicModel') || reqUrl.searchParams.get('model') || '').trim();
        openRouterKey = (req.headers['x-openrouter-key'] || '').trim();
      }

      const musicUserId = reqUserId;

      openRouterKey = String(openRouterKey || '').replace(/^Bearer\s+/i, '').trim();
      if (!openRouterKey && process.env.OPENROUTER_API_KEY) openRouterKey = process.env.OPENROUTER_API_KEY;

      const cleanPrompt = (prompt || '').trim();
      if (!cleanPrompt) {
        return sendJSON(res, 400, { success: false, error: 'Prompt musik kosong. Jelaskan musik yang ingin dibuat.' });
      }

      const rawModel = (requestedMusicModel || '').replace(/^openrouter:/i, '').trim();
      const model = rawModel || DEFAULT_MUSIC_MODEL;
      if (!MUSIC_AUDIO_MODEL_RE.test(model)) {
        return sendJSON(res, 400, {
          success: false,
          code: 'NOT_AUDIO_MODEL',
          error: `Model "${model}" adalah model teks dan tidak bisa menghasilkan audio. Pilih model pembuat musik seperti Google Lyria 3 (${DEFAULT_MUSIC_MODEL}).`,
          prompt: cleanPrompt
        });
      }
      if (!openRouterKey) {
        return sendJSON(res, 401, {
          success: false,
          code: 'NO_KEY',
          error: 'Butuh OpenRouter API Key (Pengaturan → Providers) untuk memanggil model musik AI Google Lyria.',
          prompt: cleanPrompt
        });
      }

      const tunneledPrompt = neuralTunnelMusicPrompt(cleanPrompt);
      console.log(`[AI Music] Meminta audio asli dari ${model} ...`);
      const t0 = Date.now();
      const result = await generateAudioViaOpenRouter({ model, prompt: tunneledPrompt, key: openRouterKey });
      console.log(`[AI Music] Audio diterima: ${result.audio.length} bytes dalam ${((Date.now() - t0) / 1000).toFixed(1)}s`);

      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const randSuffix = Math.random().toString(36).substring(2, 8);
      let ext = detectAudioContainer(result.audio);
      let outBuf = result.audio;
      if (!ext) {
        // PCM16 mentah (format audio OpenAI: 24 kHz mono) -> bungkus WAV
        outBuf = Buffer.concat([createWavHeader(result.audio.length, 24000, 1, 16), result.audio]);
        ext = 'wav';
      }
      const filename = `ai_music_${Date.now()}_${randSuffix}.${ext}`;
      const localFilePath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(localFilePath, outBuf);
      const url = `/uploads/${filename}`;

      let duration = /clip/i.test(model) ? 30 : 0;
      if (ext === 'wav' && outBuf.length > 44) {
        try {
          const byteRate = outBuf.readUInt32LE(28);
          if (byteRate > 0) duration = Math.round((outBuf.length - 44) / byteRate);
        } catch (_) { /* ignore */ }
      }

      const words = cleanPrompt.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 6);
      const title = words.length ? words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Lyria Track';
      const aiSummary = (result.text || '').replace(/\s+/g, ' ').slice(0, 400) || `Dihasilkan langsung oleh ${model}`;
      const genre = 'ai';

      if (sessionId) {
        appendAssistantMessageToSessionDisk(sessionId, `[Musik AI: "${cleanPrompt}"]\n\n- Judul: ${title}\n- Engine: ${model} (Audio asli dari model AI)\n- Catatan model: ${aiSummary}\n- Audio: [Putar / Unduh Audio](${url})`, 'AI Neural Music Studio', {
          userId: musicUserId,
          isMusicGen: true,
          type: 'music_generation',
          audioUrl: url,
          url: url,
          title,
          genre,
          bpm: null,
          duration,
          prompt: cleanPrompt,
          aiComposed: true,
          aiModel: model,
          aiProvider: 'openrouter',
          aiSummary
        }).catch(err => console.warn('Gagal simpan notifikasi musik AI ke sesi:', err && err.message));
      }

      return sendJSON(res, 200, {
        success: true,
        url,
        filename,
        title,
        genre,
        bpm: null,
        duration,
        sizeBytes: outBuf.length,
        format: ext,
        prompt: cleanPrompt,
        aiComposed: true,
        aiModel: model,
        aiProvider: 'openrouter',
        aiSummary
      });
    } catch (err) {
      console.error('Music generation failed:', err);
      return sendJSON(res, 502, {
        success: false,
        error: 'Gagal membuat musik AI: ' + (err.message || 'Terjadi kesalahan sistem.'),
        prompt: prompt || ''
      });
    }
  }

// Ollama: Check status & get models (with multi-route fallback & disk manifests)
  if (pathname === '/api/ollama/models' && method === 'GET') {
    let rawEndpoint = reqUrl.searchParams.get('endpoint') || req.headers['x-ollama-endpoint'] || 'http://127.0.0.1:11434';
    const authHeader = req.headers['authorization'] || (req.headers['x-ollama-key'] ? `Bearer ${req.headers['x-ollama-key']}` : null);

    if (!rawEndpoint) {
      rawEndpoint = 'http://127.0.0.1:11434';
    }

    rawEndpoint = rawEndpoint.trim();
    if (!/^https?:\/\//i.test(rawEndpoint)) {
      rawEndpoint = (rawEndpoint.includes(':443') || rawEndpoint.includes('ollama.com') || rawEndpoint.includes('.com') || rawEndpoint.includes('.io') || rawEndpoint.includes('.ai') || rawEndpoint.includes('.app')) 
        ? `https://${rawEndpoint}` 
        : `http://${rawEndpoint}`;
    }
    rawEndpoint = rawEndpoint.replace(/\/+$/, '');

    // Proteksi SSRF: blokir endpoint yang mengarah ke host privat/internal (metadata cloud, LAN, dll.)
    if (isOllamaEndpointForbidden(rawEndpoint)) {
      return sendJSON(res, 400, { error: 'Endpoint Ollama mengarah ke host privat/internal — akses diblokir (SSRF Protection).' });
    }
    // M23: DNS-rebinding guard untuk endpoint non-tepercaya.
    if (!isTrustedOllamaEndpoint(rawEndpoint)) {
      const dnsVerdict = await assertResolvesPublic(rawEndpoint);
      if (!dnsVerdict.ok) return sendJSON(res, 400, { error: dnsVerdict.msg });
    }

    // Fast-Path Cloud Architecture:
    // Jika endpoint mengarah ke loopback (127.0.0.1/localhost) atau ollama.com tanpa auth header khusus:
    // - Jika ada API key: alihkan target loopback ke ollama.com resmi
    // - Jika tanpa API key: segera kembalikan katalog resmi Ollama Cloud (< 5ms) tanpa menahan latensi connection timeout.
    const isServerlessEnv = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION || req.headers['x-vercel-id']);
    const isLoopbackTarget = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(rawEndpoint);
    if (!authHeader && (isLoopbackTarget || rawEndpoint.includes('ollama.com'))) {
      return sendJSON(res, 200, {
        models: OFFICIAL_OLLAMA_CLOUD_MODELS,
        server_running: true,
        cloud_ready: true,
        note: 'Loaded from official Ollama Cloud catalog'
      });
    }
    if (authHeader && isLoopbackTarget) {
      rawEndpoint = 'https://ollama.com';
    }

    const tryFetchTags = (endpointUrl) => {
      return new Promise((resolve) => {
        try {
          const ollamaUrl = resolveEndpointUrl(endpointUrl, 'api/tags');
          const client = ollamaUrl.protocol === 'https:' ? https : http;
          const reqHeaders = { 'User-Agent': 'ZozRouter/1.0' };
          if (authHeader) reqHeaders['Authorization'] = authHeader;

          const fetchTimeout = isServerlessEnv ? 2500 : 5000;
          const proxyReq = client.get(ollamaUrl.toString(), { timeout: fetchTimeout, headers: reqHeaders }, (proxyRes) => {
            let rawData = '';
            proxyRes.on('data', chunk => rawData += chunk);
            proxyRes.on('end', () => {
              try {
                const data = JSON.parse(rawData);
                if (data.models && Array.isArray(data.models) && data.models.length > 0) {
                  return resolve({ models: data.models, server_running: true });
                }
                resolve(null);
              } catch (e) {
                resolve(null);
              }
            });
          });
          proxyReq.on('timeout', () => { proxyReq.destroy(); resolve(null); });
          proxyReq.on('error', () => resolve(null));
        } catch (err) {
          resolve(null);
        }
      });
    };

    const tryFetchV1Models = (endpointUrl) => {
      return new Promise((resolve) => {
        try {
          const ollamaUrl = resolveEndpointUrl(endpointUrl, 'v1/models');
          const client = ollamaUrl.protocol === 'https:' ? https : http;
          const reqHeaders = { 'User-Agent': 'ZozRouter/1.0' };
          if (authHeader) reqHeaders['Authorization'] = authHeader;

          const fetchTimeout = isServerlessEnv ? 2500 : 5000;
          const proxyReq = client.get(ollamaUrl.toString(), { timeout: fetchTimeout, headers: reqHeaders }, (proxyRes) => {
            let rawData = '';
            proxyRes.on('data', chunk => rawData += chunk);
            proxyRes.on('end', () => {
              try {
                const data = JSON.parse(rawData);
                if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                  const mapped = data.data.map(m => ({
                    name: m.id,
                    model: m.id,
                    details: { family: m.id }
                  }));
                  return resolve({ models: mapped, server_running: true });
                }
                resolve(null);
              } catch (e) {
                resolve(null);
              }
            });
          });
          proxyReq.on('timeout', () => { proxyReq.destroy(); resolve(null); });
          proxyReq.on('error', () => resolve(null));
        } catch (e) {
          resolve(null);
        }
      });
    };

    (async () => {
      let result = await tryFetchTags(rawEndpoint);
      if (!result) {
        result = await tryFetchV1Models(rawEndpoint);
      }

      if (result && result.models && result.models.length > 0) {
        // Gabungkan model discovery live dengan model resmi agar model populer (qwen2.5:1.5b, dll.) tidak hilang
        const mergedModels = [...result.models];
        const existingNames = new Set(mergedModels.map(m => (m.name || m.model || m.id || '').toLowerCase()));
        OFFICIAL_OLLAMA_CLOUD_MODELS.forEach(om => {
          const omName = (om.name || om.model || om.id || '').toLowerCase();
          if (!existingNames.has(omName)) {
            mergedModels.push(om);
            existingNames.add(omName);
          }
        });
        return sendJSON(res, 200, {
          models: mergedModels,
          server_running: true,
          cloud_ready: true
        });
      }

      // If remote returned empty or failed, fallback to official Ollama Cloud catalog
      return sendJSON(res, 200, {
        models: OFFICIAL_OLLAMA_CLOUD_MODELS,
        server_running: true,
        cloud_ready: true,
        note: 'Loaded from official Ollama Cloud catalog'
      });
    })().catch(err => {
      if (!res.headersSent) {
        sendJSON(res, 500, { error: 'Gagal memuat daftar model Ollama: ' + err.message });
      }
    });
    return;
  }

  // Ollama Cloud: Get Real-Time Usage & Credits
  if (pathname === '/api/ollama/usage' && method === 'GET') {
    const rawKey = req.headers['x-ollama-key'] || (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : '') || process.env.OLLAMA_API_KEY;
    const authHeader = rawKey ? `Bearer ${rawKey}` : (req.headers['authorization'] || null);
    if (!authHeader) {
      return sendJSON(res, 401, { error: 'Ollama API key is required' });
    }

    const reqHeaders = {
      'Authorization': authHeader,
      'User-Agent': 'ZozRouter/1.0 (Windows NT 10.0; Win64; x64)',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    };
    if (rawKey) {
      reqHeaders['x-ollama-key'] = rawKey;
    }

    const options = {
      hostname: 'ollama.com',
      port: 443,
      path: '/api/usage',
      method: 'GET',
      headers: reqHeaders,
      timeout: 15000
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let rawData = '';
      proxyRes.on('data', chunk => rawData += chunk);
      proxyRes.on('end', () => {
        try {
          const data = JSON.parse(rawData);
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return sendJSON(res, proxyRes.statusCode, data);
        } catch (e) {
          return sendJSON(res, 502, { error: 'Failed to parse Ollama usage response' });
        }
      });
      proxyRes.on('error', (err) => {
        if (!res.headersSent) sendJSON(res, 502, { error: 'Failed to stream Ollama usage: ' + err.message });
      });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) sendJSON(res, 504, { error: 'Ollama usage check timed out (15s)' });
    });

    proxyReq.on('error', (err) => {
      if (res.headersSent) return;
      return sendJSON(res, 503, { error: 'Ollama usage check failed: ' + err.message });
    });

    proxyReq.end();
    return;
  }

  // Ollama: Start Background Service
  if (pathname === '/api/ollama/start' && method === 'POST') {
    // F12: endpoint ini TANPA auth dan men-spawn proses (shell:true) — tanpa jeda,
    // loop request membanjiri host dengan proses ollama/cmd.exe. Cooldown10 menit.
    const spawnNow = Date.now();
    if (spawnNow - lastOllamaSpawnAt < 10 * 60 * 1000) {
      return sendJSON(res, 429, {
        error: 'Ollama baru saja dipicu. Tunggu 10 menit sebelum memicu ulang.',
        retryAfterSec: Math.ceil((10 * 60 * 1000 - (spawnNow - lastOllamaSpawnAt)) / 1000)
      });
    }
    const { spawn } = require('child_process');
    try {
      const child = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        shell: true
      });
      child.on('error', (err) => {
        console.warn('[Ollama Background Spawn Error]:', err?.message || err);
      });
      child.unref();
      lastOllamaSpawnAt = spawnNow;
      return sendJSON(res, 200, { status: 'starting', message: 'Perintah `ollama serve` telah dipicu di latar belakang.' });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Gagal menjalankan ollama: ' + e.message });
    }
  }

  // Ollama Cloud: Chat Completion (Streaming Proxy)
  if (pathname === '/api/ollama/chat' && method === 'POST') {
    let sessionId = null; // M20: di-hoist agar catch di bawah bisa membersihkan task map
    const body = await safeParseBody(req);
    if (!body) return;
    try {
      const clientSuppliedKey = body.apiKey || body.ollamaApiKey || req.headers['x-ollama-key'] || (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : '');
      let customEndpoint = req.headers['x-ollama-endpoint'] || body.endpoint || 'http://127.0.0.1:11434';

      if (!customEndpoint) {
        customEndpoint = 'http://127.0.0.1:11434';
      }

      customEndpoint = customEndpoint.trim();
      const isServerlessChat = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION || req.headers['x-vercel-id']);
      if (isServerlessChat && /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(customEndpoint)) {
        customEndpoint = 'https://ollama.com';
      }
      if (!/^https?:\/\//i.test(customEndpoint)) {
        customEndpoint = (customEndpoint.includes(':443') || customEndpoint.includes('ollama.com') || customEndpoint.includes('.com') || customEndpoint.includes('.io') || customEndpoint.includes('.ai') || customEndpoint.includes('.app'))
          ? `https://${customEndpoint}`
          : `http://${customEndpoint}`;
      }
      customEndpoint = customEndpoint.replace(/\/+$/, '');

      // Proteksi SSRF: blokir endpoint yang mengarah ke host privat/internal (metadata cloud, LAN, dll.)
      if (isOllamaEndpointForbidden(customEndpoint)) {
        return sendJSON(res, 400, { error: 'Endpoint Ollama mengarah ke host privat/internal — akses diblokir (SSRF Protection).' });
      }
      // M23: DNS-rebinding guard — endpoint publik yang me-resolve ke IP privat ditolak.
      if (!isTrustedOllamaEndpoint(customEndpoint)) {
        const dnsVerdict = await assertResolvesPublic(customEndpoint);
        if (!dnsVerdict.ok) return sendJSON(res, 400, { error: dnsVerdict.msg });
      }

      // H6: env OLLAMA_API_KEY hanya diteruskan ke endpoint TePERCAYA
      // (localhost / ollama.com). Endpoint khusus milik klien — yang bisa
      // menunjuk ke server penyerang — TIDAK PERNAH menerima secret server;
      // klien tetap boleh memakai key miliknya sendiri via x-ollama-key.
      const rawKey = clientSuppliedKey ||
        (isTrustedOllamaEndpoint(customEndpoint) ? process.env.OLLAMA_API_KEY : null);
      const rawOllamaKey = body.ollamaApiKey || req.headers['x-ollama-key'] || (body.apiKey && !String(body.apiKey).startsWith('sk-or-') ? body.apiKey : null) || (req.headers['authorization'] && !req.headers['authorization'].includes('sk-or-') ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null);
      const isLoopbackTarget = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i.test(customEndpoint);
      const isCustomRemoteEndpoint = customEndpoint && !isLoopbackTarget && !customEndpoint.includes('ollama.com');
      const shouldUseCloudBridge = !rawOllamaKey || !isCustomRemoteEndpoint;

      if (shouldUseCloudBridge) {
        // Pure Cloud Architecture Bridge:
        // Ketika tidak ada daemon lokal atau key khusus Ollama, alihkan secara transparan ke OpenRouter Cloud AI
        // dan konversikan stream SSE OpenRouter ke format newline-delimited JSON Ollama.
        const targetCloudModel = mapOllamaModelToOpenRouter(body.model || 'qwen2.5:1.5b');
        const rawOrKey = req.headers['x-openrouter-key'] || req.headers['x-api-key'] || body.openRouterKey || (body.apiKey && body.apiKey.startsWith('sk-or-') ? body.apiKey : null) || (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null) || process.env.OPENROUTER_API_KEY;
        const openRouterKey = rawOrKey ? `Bearer ${String(rawOrKey).replace(/^Bearer\s+/i, '').trim()}` : '';

        const orPayload = {
          model: targetCloudModel,
          messages: body.messages || [],
          stream: body.stream !== false,
          max_tokens: 32768,
          provider: { allow_fallbacks: true }
        };
        if (body.options?.temperature !== undefined) orPayload.temperature = body.options.temperature;
        if (body.options?.top_p !== undefined) orPayload.top_p = body.options.top_p;

        const isFreeModel = targetCloudModel.includes(':free') || targetCloudModel.endsWith('/free') || targetCloudModel === 'openrouter/free';
        if (!isFreeModel && Array.isArray(body.tools) && body.tools.length > 0) {
          const cleanTools = body.tools.filter(t => t && t.type === 'function' && t.function && t.function.name);
          if (cleanTools.length > 0) {
            orPayload.tools = cleanTools;
            if (body.tool_choice) orPayload.tool_choice = body.tool_choice;
          }
        }

        const orPostData = JSON.stringify(orPayload);
        const orHeaders = {
          'Content-Type': 'application/json',
          'HTTP-Referer': req.headers.origin || req.headers.referer || process.env.ZOX_APP_URL || 'https://github.com/Zozi0999/zoz_router',
          'X-Title': 'ZOZ ROUTER Ollama Cloud Bridge',
          'Content-Length': Buffer.byteLength(orPostData)
        };
        if (openRouterKey) orHeaders['Authorization'] = openRouterKey;

        const orReqOptions = {
          hostname: 'openrouter.ai',
          port: 443,
          path: '/api/v1/chat/completions',
          method: 'POST',
          headers: orHeaders,
          timeout: 120000
        };

        const isStream = body.stream !== false;
        if (isStream) {
          res.writeHead(200, {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          });
        }

        const bridgeReq = https.request(orReqOptions, (bridgeRes) => {
          const bStatus = bridgeRes.statusCode || 200;
          if (bStatus >= 400) {
            let errBuf = '';
            bridgeRes.on('data', chunk => errBuf += chunk);
            bridgeRes.on('end', () => {
              if (res.writableEnded) return;
              try {
                const parsed = JSON.parse(errBuf);
                const msg = parsed?.error?.message || parsed?.error || `OpenRouter bridge error: HTTP ${bStatus}`;
                if (isStream) {
                  res.write(JSON.stringify({ error: msg }) + '\n');
                  res.end();
                } else {
                  sendJSON(res, bStatus, { error: msg });
                }
              } catch (_) {
                if (isStream) {
                  res.write(JSON.stringify({ error: errBuf || `HTTP ${bStatus}` }) + '\n');
                  res.end();
                } else {
                  sendJSON(res, bStatus, { error: errBuf || `HTTP ${bStatus}` });
                }
              }
            });
            return;
          }

          if (!isStream) {
            let rawResp = '';
            bridgeRes.on('data', chunk => rawResp += chunk);
            bridgeRes.on('end', () => {
              try {
                const parsed = JSON.parse(rawResp);
                const txt = parsed.choices?.[0]?.message?.content || '';
                const reasoning = parsed.choices?.[0]?.message?.reasoning || parsed.choices?.[0]?.message?.reasoning_content || '';
                const msgPayload = { role: 'assistant', content: txt };
                if (parsed.choices?.[0]?.message?.tool_calls) {
                  msgPayload.tool_calls = parsed.choices[0].message.tool_calls;
                }
                if (reasoning) {
                  msgPayload.reasoning = reasoning;
                }
                sendJSON(res, 200, {
                  model: body.model || 'qwen2.5:1.5b',
                  created_at: new Date().toISOString(),
                  message: msgPayload,
                  done: true
                });
              } catch (e) {
                sendJSON(res, 500, { error: 'Gagal memproses respon bridge: ' + e.message });
              }
            });
            return;
          }

          let sseBuffer = '';
          bridgeRes.on('data', chunk => {
            sseBuffer += chunk.toString();
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const dataStr = trimmed.slice(5).trim();
              if (dataStr === '[DONE]') {
                res.write(JSON.stringify({
                  model: body.model || 'qwen2.5:1.5b',
                  created_at: new Date().toISOString(),
                  message: { role: 'assistant', content: '' },
                  done: true
                }) + '\n');
                continue;
              }
              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta?.content || '';
                const deltaToolCalls = parsed.choices?.[0]?.delta?.tool_calls;
                const deltaReasoning = parsed.choices?.[0]?.delta?.reasoning || parsed.choices?.[0]?.delta?.reasoning_content || '';
                if (delta || deltaToolCalls || deltaReasoning) {
                  const msgPayload = { role: 'assistant', content: delta };
                  if (deltaToolCalls) msgPayload.tool_calls = deltaToolCalls;
                  if (deltaReasoning) msgPayload.reasoning = deltaReasoning;
                  res.write(JSON.stringify({
                    model: body.model || 'qwen2.5:1.5b',
                    created_at: new Date().toISOString(),
                    message: msgPayload,
                    done: false
                  }) + '\n');
                }
              } catch (_) {}

            }
          });

          bridgeRes.on('end', () => {
            if (!res.writableEnded) {
              res.write(JSON.stringify({
                model: body.model || 'qwen2.5:1.5b',
                created_at: new Date().toISOString(),
                message: { role: 'assistant', content: '' },
                done: true
              }) + '\n');
              res.end();
            }
          });
        });

        bridgeReq.on('error', (err) => {
          if (!res.writableEnded) {
            if (isStream) {
              res.write(JSON.stringify({ error: 'Bridge network error: ' + err.message }) + '\n');
              res.end();
            } else {
              sendJSON(res, 500, { error: 'Bridge network error: ' + err.message });
            }
          }
        });

        req.on('close', () => {
          if (!res.writableEnded) {
            try { bridgeReq.destroy(); } catch (_) {}
          }
        });

        bridgeReq.write(orPostData);
        bridgeReq.end();
        return;
      }

      if (!body.model) {
        body.model = 'qwen2.5:1.5b';
      }

      sessionId = sanitizeTaskKey(body.sessionId || req.headers['x-session-id'] || null);
      const chatUserId = reqUserId;
      let userPrompt = null;
      if (Array.isArray(body.messages) && body.messages.length > 0) {
        const lastUser = [...body.messages].reverse().find(m => m.role === 'user');
        if (lastUser) {
          userPrompt = typeof lastUser.content === 'string'
            ? lastUser.content
            : (Array.isArray(lastUser.content)
                ? lastUser.content.map(c => c.text || (c.type === 'text' ? c.text : '')).filter(Boolean).join('\n')
                : '');
        }
      }
      delete body.sessionId;
      delete body.endpoint; // Don't send custom field to Ollama
      delete body.apiKey;
      delete body.ollamaApiKey;

      if (!body.options || typeof body.options !== 'object') body.options = {};
      if (body.options.num_predict === undefined) body.options.num_predict = -1;
      if (body.options.num_ctx === undefined) body.options.num_ctx = 32768;

      // Defense-in-depth: Resolusi dan sanitasi gambar lokal (/uploads/) menjadi raw Base64 untuk endpoint Ollama
      if (Array.isArray(body.messages)) {
        for (const msg of body.messages) {
          // 1. Ekstrak gambar dari format multimodal content part (jika dikirim dalam format OpenAI/OpenRouter)
          if (Array.isArray(msg.content)) {
            const textParts = [];
            if (!Array.isArray(msg.images)) msg.images = [];
            for (const part of msg.content) {
              if (part && part.type === 'text') {
                textParts.push(part.text || '');
              } else if (part && part.type === 'image_url' && part.image_url?.url) {
                msg.images.push(part.image_url.url);
              }
            }
            msg.content = textParts.join('\n').trim();
          }

          // 2. Sanitasi seluruh array msg.images menjadi string Base64 murni tanpa scheme/path
          if (Array.isArray(msg.images)) {
            msg.images = msg.images.map(img => {
              if (typeof img === 'string') {
                if (img.startsWith('data:image')) {
                  return img.replace(/^data:image\/[a-z0-9.+_-]+;base64,/i, '').replace(/[\r\n\s]/g, '');
                }
                const uploadMatch = img.match(/(?:\/uploads\/|^uploads\/)([a-zA-Z0-9_.-]+)$/);
                if (uploadMatch) {
                  const filename = uploadMatch[1];
                  const localPath = path.join(UPLOADS_DIR, filename);
                  if (fs.existsSync(localPath)) {
                    try {
                      return fs.readFileSync(localPath).toString('base64');
                    } catch (_) {}
                  }
                }
              }
              return img;
            });
          }
        }
      }

      if (sessionId) {
        if (dbActiveChatTasks[sessionId] && dbActiveChatTasks[sessionId].status === 'streaming') {
          return sendJSON(res, 429, { error: 'Stream already active for this session' });
        }
        dbActiveChatTasks[sessionId] = {
          sessionId,
          userId: chatUserId,
          model: body.model || 'Ollama Model',
          provider: 'ollama',
          userPrompt: userPrompt || null,
          fullText: '',
          fullBytes: 0,
          fullEpoch: 0,
          rawBuffer: '',
          status: 'streaming',
          startedAt: Date.now(),
          proxyReq: null
        };
      }

      const ollamaUrl = resolveEndpointUrl(customEndpoint, 'api/chat');
      const client = ollamaUrl.protocol === 'https:' ? https : http;

      const isStream = body.stream !== false;
      const postData = JSON.stringify(body);

      const proxyHeaders = {
        'Content-Type': 'application/json',
        'User-Agent': 'ZozRouter/1.0 (Windows NT 10.0; Win64; x64)',
        'Content-Length': Buffer.byteLength(postData)
      };
      if (authHeader) {
        proxyHeaders['Authorization'] = authHeader;
      }
      if (rawKey) {
        proxyHeaders['x-ollama-key'] = rawKey;
      }

      let clientDisconnected = false;
      let proxyReq = null;

      res.on('close', () => {
        if (res.writableEnded) return; // penyelesaian normal, bukan disconnect klien
        clientDisconnected = true;
        // JANGAN hancurkan proxyReq jika sessionId ada! Biarkan server menyelesaikan generasi LLM di latar belakang
        // layaknya di Claude AI agar jawaban tersimpan utuh ke disk sesi saat pengguna menutup peramban/aplikasi.
        if (!sessionId && proxyReq && !proxyReq.destroyed) {
          proxyReq.destroy();
        }
      });

      proxyReq = client.request(ollamaUrl.toString(), {
        method: 'POST',
        headers: proxyHeaders,
        timeout: 120000
      }, (proxyRes) => {
        if (sessionId && dbActiveChatTasks[sessionId]) {
          dbActiveChatTasks[sessionId].proxyReq = proxyReq;
        }

        // Jika tugas telah dibatalkan oleh pengguna sebelum respon pertama tiba
        if (sessionId && dbActiveChatTasks[sessionId]?.status === 'aborted') {
          if (!proxyReq.destroyed) proxyReq.destroy();
          // Clean up aborted task
          delete dbActiveChatTasks[sessionId];
          return;
        }

        if (clientDisconnected || res.writableEnded || res.destroyed) {
          if (!sessionId && !proxyReq.destroyed) proxyReq.destroy();
          if (!sessionId) return;
        }

        const statusCode = proxyRes.statusCode || 200;

        // If upstream returned error (HTTP >= 400)
        if (statusCode >= 400) {
          if (sessionId && dbActiveChatTasks[sessionId]) {
            dbActiveChatTasks[sessionId].status = 'error';
          }
          let errData = '';
          proxyRes.on('data', chunk => {
            if (!clientDisconnected) errData += chunk;
          });
          proxyRes.on('end', () => {
            if (sessionId) {
              delete dbActiveChatTasks[sessionId];
            }
            if (clientDisconnected || res.writableEnded || res.destroyed) return;
            try {
              let parsedErr = null;
              try { parsedErr = JSON.parse(errData); } catch (e) {}
              const errMsg = parsedErr?.error?.message || parsedErr?.error || errData || `Ollama error [${statusCode}]`;
              return sendJSON(res, statusCode, { error: errMsg, details: parsedErr || errData });
            } catch (e) {}
          });
          proxyRes.on('error', (err) => {
            if (sessionId) {
              delete dbActiveChatTasks[sessionId];
            }
            if (clientDisconnected || res.writableEnded || res.destroyed) return;
            if (!res.headersSent) {
              sendJSON(res, 502, { error: `Ollama upstream error stream interrupted: ${err.message}` });
            }
          });
          return;
        }

        // Upstream returned 200 OK -> Send headers matching client stream mode!
        const contentType = isStream ? 'text/event-stream; charset=utf-8' : (proxyRes.headers['content-type'] || 'application/json; charset=utf-8');
        const reasoningFilter = textSafety.createProviderStreamFilter('ollama', isStream ? 'stream' : 'json');
        if (!clientDisconnected && !res.headersSent && !res.writableEnded && !res.destroyed) {
          try {
            res.writeHead(200, {
              'Content-Type': contentType,
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*'
            });
          } catch (writeHeadErr) {
            console.warn('Notice writing head to client (Ollama):', writeHeadErr.message);
          }
        }

        proxyRes.on('data', chunk => {
          const safeChunk = reasoningFilter.push(chunk);
          // Persist hanya event jawaban bersih; reasoning provider tidak disimpan.
          if (sessionId && safeChunk) accumulateChatChunk(sessionId, safeChunk, 'ollama');

          if (clientDisconnected || res.writableEnded || res.destroyed) {
            if (!sessionId && !proxyReq.destroyed) proxyReq.destroy();
            return;
          }
          try {
            if (!safeChunk) return;
            const flushed = res.write(safeChunk);
            // M27: hormati backpressure — klien lambat yang berhenti membaca
            // (tapi socket tetap terbuka) menghentikan sementara upstream alih-alih
            // menumpuk token tak terbatas di memori proses.
            if (flushed === false && typeof proxyRes.pause === 'function') {
              proxyRes.pause();
              res.once('drain', () => { try { proxyRes.resume(); } catch (_) {} });
            }
          } catch (e) {}
        });

        proxyRes.on('end', () => {
          const safeTail = reasoningFilter.end();
          if (sessionId && safeTail) accumulateChatChunk(sessionId, safeTail, 'ollama');
          if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
            try {
              if (safeTail) res.write(safeTail);
              res.end();
            } catch (e) {}
          }

          // Simpan hasil akhir asisten ke disk perangkat jika ada sessionId
          if (sessionId && dbActiveChatTasks[sessionId]) {
            if (dbActiveChatTasks[sessionId].status === 'aborted') {
              // Jangan timpa status aborted dan jangan simpan ulang
              delete dbActiveChatTasks[sessionId];
              return;
            }
            flushChatTaskBuffer(sessionId, 'ollama');
            const task = dbActiveChatTasks[sessionId];
            task.status = 'completed';
            task.completedAt = Date.now();
            if (task.fullText && task.fullText.trim()) {
              appendAssistantMessageToSessionDisk(sessionId, task.fullText, task.model)
                .catch(err => console.warn('Gagal simpan respons chat ke sesi:', err && err.message));
            }
            // Clean up completed task
            delete dbActiveChatTasks[sessionId];
          }
        });

        proxyRes.on('error', (err) => {
          if (sessionId && dbActiveChatTasks[sessionId]) {
            markChatTaskInterrupted(sessionId, err.message || 'Ollama stream interrupted');
          }
          if (clientDisconnected || res.writableEnded || res.destroyed) return;
          try {
            if (!res.headersSent) {
              return sendJSON(res, 502, { error: `Ollama Response Stream Error: ${err.message}` });
            }
            res.write(JSON.stringify({ error: `Ollama Response Stream Error: ${err.message}` }) + '\n');
            res.end();
          } catch (e) {}
        });
      });

      if (sessionId && dbActiveChatTasks[sessionId]) {
        dbActiveChatTasks[sessionId].proxyReq = proxyReq;
      }

      proxyReq.on('timeout', () => {
        if (sessionId && dbActiveChatTasks[sessionId]) {
          markChatTaskInterrupted(sessionId, 'Ollama stream timed out (120s)');
        }
        if (!proxyReq.destroyed) proxyReq.destroy();
        if (clientDisconnected || res.writableEnded || res.destroyed) return;
        try {
          if (!res.headersSent) {
            sendJSON(res, 504, { error: 'Ollama stream timed out (120s)' });
          } else {
            if (isStream) {
              res.write(JSON.stringify({ error: 'Ollama stream timed out (120s)' }) + '\n');
            }
            res.end();
          }
        } catch (_) {}
      });

      proxyReq.on('error', (err) => {
        if (sessionId && dbActiveChatTasks[sessionId]) {
          markChatTaskInterrupted(sessionId, err.message || 'Ollama connection error');
        }
        // If client closed or socket was destroyed on abort, suppress write-after-end errors
        if (clientDisconnected || res.writableEnded || res.destroyed) {
          return;
        }
        try {
          if (!res.headersSent) {
            return sendJSON(res, 503, { error: `Ollama Stream Error (offline/unreachable): ${err.message}` });
          }
          res.write(JSON.stringify({ error: `Ollama Stream Error: ${err.message}` }) + '\n');
          res.end();
        } catch (e) {}
      });

      proxyReq.write(postData);
      proxyReq.end();
    } catch (err) {
      // Pembersihan aman jika terjadi throw sinkron (ERR_INVALID_CHAR, payload error, socket write error)
      if (sessionId && dbActiveChatTasks[sessionId]) {
        try {
          if (dbActiveChatTasks[sessionId].proxyReq && !dbActiveChatTasks[sessionId].proxyReq.destroyed) {
            dbActiveChatTasks[sessionId].proxyReq.destroy();
          }
        } catch (_) {}
        delete dbActiveChatTasks[sessionId];
      }
      return sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // OpenRouter Models In-Memory Optimization & CDN Cache
  const OPENROUTER_MODELS_CACHE_TTL = 10 * 60 * 1000; // 10 menit
  let cachedOpenRouterModelsPayload = null;
  let cachedOpenRouterModelsAt = 0;

  // OpenRouter: Get Model List (Optimized & Compacted)
  if (pathname === '/api/openrouter/models' && method === 'GET') {
    // Return cached compact payload if fresh
    const now = Date.now();
    if (cachedOpenRouterModelsPayload && (now - cachedOpenRouterModelsAt < OPENROUTER_MODELS_CACHE_TTL)) {
      return sendJSON(res, 200, cachedOpenRouterModelsPayload);
    }

    let authHeader = req.headers['authorization'];
    if (!authHeader) {
      const qKey = req.headers['x-openrouter-key'] || req.headers['x-api-key'] || process.env.OPENROUTER_API_KEY;
      if (qKey) authHeader = `Bearer ${String(qKey).replace(/^Bearer\s+/i, '').trim()}`;
    }
    const options = {
      hostname: 'openrouter.ai',
      port: 443,
      path: '/api/v1/models',
      method: 'GET',
      headers: {
        'User-Agent': 'ZozRouter/1.0',
        ...(authHeader ? { 'Authorization': authHeader } : {})
      },
      timeout: 15000
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let rawData = '';
      proxyRes.on('data', chunk => rawData += chunk);
      proxyRes.on('end', () => {
        try {
          const data = JSON.parse(rawData);
          if (proxyRes.statusCode < 200 || proxyRes.statusCode >= 300) {
            if (cachedOpenRouterModelsPayload) {
              return sendJSON(res, 200, cachedOpenRouterModelsPayload);
            }
            return sendJSON(res, proxyRes.statusCode, {
              success: false,
              data: [],
              error: data?.error?.message || data?.message || `HTTP ${proxyRes.statusCode} from OpenRouter`,
              ...data
            });
          }

          // Compact model payload down from ~780KB to ~40KB (strip internal schemas, route definitions, prompt templates)
          if (data && Array.isArray(data.data)) {
            const compactPayload = {
              data: data.data.map(m => ({
                id: m.id,
                name: m.name || m.id,
                description: typeof m.description === 'string' ? m.description.slice(0, 160) : '',
                context_length: m.context_length || null,
                pricing: m.pricing ? { prompt: m.pricing.prompt, completion: m.pricing.completion } : undefined,
                supported_parameters: Array.isArray(m.supported_parameters) && m.supported_parameters.includes('tools') ? ['tools'] : [],
                architecture: m.architecture ? {
                  output_modalities: m.architecture.output_modalities,
                  modality: m.architecture.modality
                } : undefined
              }))
            };
            cachedOpenRouterModelsPayload = compactPayload;
            cachedOpenRouterModelsAt = Date.now();
            return sendJSON(res, 200, compactPayload);
          }

          return sendJSON(res, proxyRes.statusCode, data);
        } catch (e) {
          if (cachedOpenRouterModelsPayload) {
            return sendJSON(res, 200, cachedOpenRouterModelsPayload);
          }
          return sendJSON(res, 502, { success: false, data: [], error: 'Failed to parse OpenRouter response' });
        }
      });
      proxyRes.on('error', (err) => {
        if (!res.headersSent) {
          if (cachedOpenRouterModelsPayload) {
            return sendJSON(res, 200, cachedOpenRouterModelsPayload);
          }
          sendJSON(res, 502, { success: false, data: [], error: 'OpenRouter models stream error: ' + err.message });
        }
      });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        if (cachedOpenRouterModelsPayload) {
          return sendJSON(res, 200, cachedOpenRouterModelsPayload);
        }
        sendJSON(res, 504, { error: 'OpenRouter models request timed out (15s)' });
      }
    });

    proxyReq.on('error', (err) => {
      if (res.headersSent) return;
      if (cachedOpenRouterModelsPayload) {
        return sendJSON(res, 200, cachedOpenRouterModelsPayload);
      }
      return sendJSON(res, 503, { error: 'OpenRouter connection error: ' + err.message });
    });

    proxyReq.end();
    return;
  }

  // OpenRouter: Get Image Model List
  if ((pathname === '/api/openrouter/images/models' || pathname === '/api/openrouter/image-models') && method === 'GET') {
    let authHeader = req.headers['authorization'];
    if (!authHeader) {
      const qKey = req.headers['x-openrouter-key'] || req.headers['x-api-key'] || process.env.OPENROUTER_API_KEY;
      if (qKey) authHeader = `Bearer ${String(qKey).replace(/^Bearer\s+/i, '').trim()}`;
    }
    const options = {
      hostname: 'openrouter.ai',
      port: 443,
      path: '/api/v1/images/models',
      method: 'GET',
      headers: {
        'User-Agent': 'ZozRouter/1.0',
        ...(authHeader ? { 'Authorization': authHeader } : {})
      },
      timeout: 15000
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let rawData = '';
      proxyRes.on('data', chunk => rawData += chunk);
      proxyRes.on('end', () => {
        try {
          const data = JSON.parse(rawData);
          if (proxyRes.statusCode < 200 || proxyRes.statusCode >= 300) {
            return sendJSON(res, proxyRes.statusCode, {
              success: false,
              data: [],
              error: data?.error?.message || data?.message || `HTTP ${proxyRes.statusCode} from OpenRouter`,
              ...data
            });
          }
          return sendJSON(res, proxyRes.statusCode, data);
        } catch (e) {
          return sendJSON(res, 502, { success: false, data: [], error: 'Failed to parse OpenRouter image models response' });
        }
      });
      proxyRes.on('error', (err) => {
        if (!res.headersSent) sendJSON(res, 502, { success: false, data: [], error: 'OpenRouter image models stream error: ' + err.message });
      });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) sendJSON(res, 504, { error: 'OpenRouter image models request timed out (15s)' });
    });

    proxyReq.on('error', (err) => {
      if (res.headersSent) return;
      return sendJSON(res, 503, { error: 'OpenRouter connection error: ' + err.message });
    });

    proxyReq.end();
    return;
  }

  // OpenRouter: Validate API Key / Check Auth Status
  if (pathname === '/api/openrouter/auth-check' && method === 'GET') {
    let authHeader = req.headers['authorization'];
    if (!authHeader) {
      const qKey = req.headers['x-openrouter-key'] || req.headers['x-api-key'] || process.env.OPENROUTER_API_KEY;
      if (qKey) authHeader = `Bearer ${String(qKey).replace(/^Bearer\s+/i, '').trim()}`;
    }
    if (!authHeader) {
      return sendJSON(res, 401, { error: 'Authorization header is required' });
    }

    const options = {
      hostname: 'openrouter.ai',
      port: 443,
      path: '/api/v1/auth/key',
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'ZozRouter/1.0'
      },
      timeout: 15000
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let rawData = '';
      proxyRes.on('data', chunk => rawData += chunk);
      proxyRes.on('end', () => {
        try {
          const data = JSON.parse(rawData);
          return sendJSON(res, proxyRes.statusCode, data);
        } catch (e) {
          return sendJSON(res, 502, { error: 'Failed to parse auth response' });
        }
      });
      proxyRes.on('error', (err) => {
        if (!res.headersSent) sendJSON(res, 502, { error: 'Auth check stream error: ' + err.message });
      });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) sendJSON(res, 504, { error: 'OpenRouter auth check timed out (15s)' });
    });

    proxyReq.on('error', (err) => {
      if (res.headersSent) return;
      return sendJSON(res, 503, { error: 'Auth check failed: ' + err.message });
    });

    proxyReq.end();
    return;
  }

  // OpenRouter: Get Real-Time Credits & Balance
  if (pathname === '/api/openrouter/credits' && method === 'GET') {
    let authHeader = req.headers['authorization'];
    if (!authHeader) {
      const qKey = req.headers['x-openrouter-key'] || req.headers['x-api-key'] || process.env.OPENROUTER_API_KEY;
      if (qKey) authHeader = `Bearer ${String(qKey).replace(/^Bearer\s+/i, '').trim()}`;
    }
    if (!authHeader) {
      return sendJSON(res, 401, { error: 'Authorization header is required' });
    }

    const options = {
      hostname: 'openrouter.ai',
      port: 443,
      path: '/api/v1/credits',
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'ZozRouter/1.0'
      },
      timeout: 15000
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let rawData = '';
      proxyRes.on('data', chunk => rawData += chunk);
      proxyRes.on('end', () => {
        try {
          const data = JSON.parse(rawData);
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return sendJSON(res, proxyRes.statusCode, data);
        } catch (e) {
          return sendJSON(res, 502, { error: 'Failed to parse credits response' });
        }
      });
      proxyRes.on('error', (err) => {
        if (!res.headersSent) sendJSON(res, 502, { error: 'Credits check stream error: ' + err.message });
      });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) sendJSON(res, 504, { error: 'OpenRouter credits request timed out (15s)' });
    });

    proxyReq.on('error', (err) => {
      if (res.headersSent) return;
      return sendJSON(res, 503, { error: 'Credits check failed: ' + err.message });
    });

    proxyReq.end();
    return;
  }

  // OpenRouter: Chat Completion (Streaming Proxy)
  if (pathname === '/api/openrouter/chat' && method === 'POST') {
    let sessionId = null; // M20: di-hoist agar catch di bawah bisa membersihkan task map
    const body = await safeParseBody(req);
    if (!body) return;
    try {
      const authHeader = req.headers['authorization'];
      const rawKey = body.apiKey || body.openRouterKey || req.headers['x-openrouter-key'] || req.headers['x-api-key'] || (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || process.env.OPENROUTER_API_KEY;

      if (!rawKey) {
        return sendJSON(res, 401, { error: 'OpenRouter API Key diperlukan. Masukkan API Key di Pengaturan Zoz Router.' });
      }

      const apiKey = `Bearer ${String(rawKey).replace(/^Bearer\s+/i, '').trim()}`;
      delete body.apiKey;
      delete body.openRouterKey;

      sessionId = sanitizeTaskKey(body.sessionId || req.headers['x-session-id'] || null);
      const chatUserId = reqUserId;
      let userPrompt = null;
      if (Array.isArray(body.messages) && body.messages.length > 0) {
        const lastUser = [...body.messages].reverse().find(m => m.role === 'user');
        if (lastUser) {
          userPrompt = typeof lastUser.content === 'string'
            ? lastUser.content
            : (Array.isArray(lastUser.content)
                ? lastUser.content.map(c => c.text || (c.type === 'text' ? c.text : '')).filter(Boolean).join('\n')
                : '');
        }
      }
      delete body.sessionId;
      delete body.userId; // Cegah error Pydantic / upstream validation di OpenRouter

      if (sessionId) {
        if (dbActiveChatTasks[sessionId] && dbActiveChatTasks[sessionId].status === 'streaming') {
          return sendJSON(res, 429, { error: 'Stream already active for this session' });
        }
        dbActiveChatTasks[sessionId] = {
          sessionId,
          userId: chatUserId,
          model: body.model || 'OpenRouter Model',
          provider: 'openrouter',
          userPrompt: userPrompt || null,
          fullText: '',
          fullBytes: 0,
          fullEpoch: 0,
          rawBuffer: '',
          status: 'streaming',
          startedAt: Date.now(),
          proxyReq: null
        };
      }

      // Defense-in-depth: Normalisasi model jika format tanpa slash (misal format Ollama gemma4:31b) dikirim ke OpenRouter
      if (body.model && !body.model.includes('/')) {
        body.model = mapOllamaModelToOpenRouter(body.model);
      }

      // Defense-in-depth: Cegah konflik mutlak parameter model dan models pada OpenRouter
      if (Array.isArray(body.models)) {
        if (body.models.length > 3) {
          body.models = body.models.slice(0, 3);
        }
      }
      if (body.model && body.models) {
        delete body.models;
      }
      if (body.repetition_penalty !== undefined) {
        delete body.repetition_penalty;
      }

      // Pastikan kuota token output memadai (default normal chat ke 4096 agar tidak memicu HTTP 402/ResourceExhausted)
      if (!body.max_tokens && !body.max_completion_tokens) {
        body.max_tokens = 4096;
      }

      // Defense-in-depth: Hapus tool jika model gratis, atau filter tool agar hanya fungsi bertipe 'function'
      const isFree = body.model && (body.model.includes(':free') || body.model.endsWith('/free') || body.model === 'openrouter/free');
      if (isFree && Array.isArray(body.tools)) {
        delete body.tools;
        delete body.tool_choice;
      } else if (Array.isArray(body.tools)) {
        body.tools = body.tools.filter(t => t && t.type === 'function' && t.function && t.function.name);
        if (body.tools.length === 0) {
          delete body.tools;
          delete body.tool_choice;
        }
      }
      if (!body.tools && body.tool_choice) {
        delete body.tool_choice;
      }

      // Defense-in-depth: Hapus parameter yang tidak didukung pada model tertentu (misal: top_p pada Liquid AI / reasoning)
      const reqModel = String(body.model || '');
      const isLiquid = reqModel.includes('liquid') || reqModel.includes('lfm-');
      const isReasoning = Boolean(reqModel && (/\/o[1-9]|\b(r1|reasoning|deepseek-r)\b/i.test(reqModel) || reqModel.toLowerCase().includes('reasoning') || reqModel.toLowerCase().includes('-r1')));
      if (isLiquid && body.top_p !== undefined) {
        delete body.top_p;
      }
      if (isReasoning) {
        if (body.temperature !== undefined) delete body.temperature;
        if (body.top_p !== undefined) delete body.top_p;
      }

      // Defense-in-depth: Resolusi gambar lokal (/uploads/) menjadi Base64 data URL agar OpenRouter tidak merejeksi private IP
      if (Array.isArray(body.messages)) {
        for (const msg of body.messages) {
          if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part && part.type === 'image_url' && part.image_url && typeof part.image_url.url === 'string') {
                const imgUrl = part.image_url.url;
                const uploadMatch = imgUrl.match(/(?:\/uploads\/|^uploads\/)([a-zA-Z0-9_.-]+)$/);
                if (uploadMatch) {
                  const filename = uploadMatch[1];
                  const localPath = path.join(UPLOADS_DIR, filename);
                  if (fs.existsSync(localPath)) {
                    try {
                      const ext = path.extname(filename).toLowerCase().replace('.', '') || 'png';
                      const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : (ext === 'webp' ? 'image/webp' : 'image/png');
                      const b64 = fs.readFileSync(localPath).toString('base64');
                      part.image_url.url = `data:${mime};base64,${b64}`;
                    } catch (_) {}
                  }
                }
              }
            }
          }
        }
      }

      const isStream = body.stream !== false;
      const postData = JSON.stringify(body);

      const options = {
        hostname: 'openrouter.ai',
        port: 443,
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
          'HTTP-Referer': req.headers.origin || req.headers.referer || process.env.ZOX_APP_URL || 'https://github.com/Zozi0999/zoz_router',
          'X-Title': 'ZOZ ROUTER Neural AI Gateway',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 45000
      };

      let clientDisconnected = false;
      let proxyReq = null;

      res.on('close', () => {
        if (res.writableEnded) return; // penyelesaian normal, bukan disconnect klien
        clientDisconnected = true;
        // JANGAN hancurkan proxyReq jika sessionId ada! Biarkan server menyelesaikan generasi LLM di latar belakang
        // layaknya di Claude AI agar jawaban tersimpan utuh ke disk sesi saat pengguna menutup peramban/aplikasi.
        if (!sessionId && proxyReq && !proxyReq.destroyed) {
          proxyReq.destroy();
        }
      });

      proxyReq = https.request(options, (proxyRes) => {
        if (sessionId && dbActiveChatTasks[sessionId]) {
          dbActiveChatTasks[sessionId].proxyReq = proxyReq;
        }

        // Jika tugas telah dibatalkan oleh pengguna sebelum respon pertama tiba
        if (sessionId && dbActiveChatTasks[sessionId]?.status === 'aborted') {
          if (!proxyReq.destroyed) proxyReq.destroy();
          // Clean up aborted task
          delete dbActiveChatTasks[sessionId];
          return;
        }

        if (clientDisconnected || res.writableEnded || res.destroyed) {
          if (!sessionId && !proxyReq.destroyed) proxyReq.destroy();
          if (!sessionId) return;
        }

        const statusCode = proxyRes.statusCode || 200;

        // If OpenRouter returned non-200 (e.g. 401 Unauthorized, 402 Payment Required, 429 Rate Limit)
        if (statusCode !== 200) {
          if (sessionId && dbActiveChatTasks[sessionId]) {
            dbActiveChatTasks[sessionId].status = 'error';
          }
          let errData = '';
          proxyRes.on('data', chunk => {
            if (!clientDisconnected) errData += chunk;
          });
          proxyRes.on('end', () => {
            if (sessionId) {
              delete dbActiveChatTasks[sessionId];
            }
            if (clientDisconnected || res.writableEnded || res.destroyed) return;
            try {
              let parsedErr = null;
              try { parsedErr = JSON.parse(errData); } catch (e) {}
              const errMsg = parsedErr?.error?.message || parsedErr?.error || errData || `OpenRouter Error [${statusCode}]`;
              return sendJSON(res, statusCode, { error: errMsg, details: parsedErr || errData });
            } catch (e) {}
          });
          proxyRes.on('error', (err) => {
            if (sessionId) {
              delete dbActiveChatTasks[sessionId];
            }
            if (clientDisconnected || res.writableEnded || res.destroyed) return;
            if (!res.headersSent) {
              sendJSON(res, 502, { error: `OpenRouter error stream interrupted: ${err.message}` });
            }
          });
          return;
        }

        // OpenRouter returned 200 OK -> Send headers matching client stream mode!
        const contentType = isStream ? 'text/event-stream; charset=utf-8' : (proxyRes.headers['content-type'] || 'application/json; charset=utf-8');
        const reasoningFilter = textSafety.createProviderStreamFilter('openrouter', isStream ? 'stream' : 'json');
        if (!clientDisconnected && !res.headersSent && !res.writableEnded && !res.destroyed) {
          try {
            res.writeHead(200, {
              'Content-Type': contentType,
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*'
            });
          } catch (writeHeadErr) {
            console.warn('Notice writing head to client (OpenRouter):', writeHeadErr.message);
          }
        }

        proxyRes.on('data', chunk => {
          const safeChunk = reasoningFilter.push(chunk);
          // Background task menerima frame yang sama setelah reasoning dihapus.
          if (sessionId && safeChunk) accumulateChatChunk(sessionId, safeChunk, 'openrouter');

          if (clientDisconnected || res.writableEnded || res.destroyed) {
            if (!sessionId && proxyReq && !proxyReq.destroyed) proxyReq.destroy();
            return;
          }
          try {
            if (!safeChunk) return;
            const flushed = res.write(safeChunk);
            // M27: backpressure — hentikan baca upstream saat klien lambat.
            if (flushed === false && typeof proxyRes.pause === 'function') {
              proxyRes.pause();
              res.once('drain', () => { try { proxyRes.resume(); } catch (_) {} });
            }
          } catch (e) {}
        });

        proxyRes.on('end', () => {
          const safeTail = reasoningFilter.end();
          if (sessionId && safeTail) accumulateChatChunk(sessionId, safeTail, 'openrouter');
          if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
            try {
              if (safeTail) res.write(safeTail);
              res.end();
            } catch (e) {}
          }

          // Simpan hasil akhir asisten ke disk perangkat jika ada sessionId
          if (sessionId && dbActiveChatTasks[sessionId]) {
            if (dbActiveChatTasks[sessionId].status === 'aborted') {
              // Jangan timpa status aborted dan jangan simpan ulang
              delete dbActiveChatTasks[sessionId];
              return;
            }
            flushChatTaskBuffer(sessionId, 'openrouter');
            const task = dbActiveChatTasks[sessionId];
            task.status = 'completed';
            task.completedAt = Date.now();
            if (task.fullText && task.fullText.trim()) {
              appendAssistantMessageToSessionDisk(sessionId, task.fullText, task.model)
                .catch(err => console.warn('Gagal simpan respons chat ke sesi:', err && err.message));
            }
            // Clean up completed task
            delete dbActiveChatTasks[sessionId];
          }
        });

        proxyRes.on('error', (err) => {
          if (sessionId && dbActiveChatTasks[sessionId]) {
            markChatTaskInterrupted(sessionId, err.message || 'OpenRouter stream interrupted');
          }
          if (clientDisconnected || res.writableEnded || res.destroyed) return;
          try {
            if (!res.headersSent) {
              return sendJSON(res, 502, { error: `OpenRouter Response Stream Error: ${err.message}` });
            }
            if (isStream) {
              res.write(`data: ${JSON.stringify({ error: `OpenRouter Response Stream Error: ${err.message}` })}\n\n`);
              res.write('data: [DONE]\n\n');
            }
            res.end();
          } catch (e) {}
        });
      });

      if (sessionId && dbActiveChatTasks[sessionId]) {
        dbActiveChatTasks[sessionId].proxyReq = proxyReq;
      }

      proxyReq.on('timeout', () => {
        if (sessionId && dbActiveChatTasks[sessionId]) {
          markChatTaskInterrupted(sessionId, 'OpenRouter stream timed out (120s)');
        }
        if (!proxyReq.destroyed) proxyReq.destroy();
        if (clientDisconnected || res.writableEnded || res.destroyed) return;
        try {
          if (!res.headersSent) {
            sendJSON(res, 504, { error: 'OpenRouter stream timed out (120s)' });
          } else {
            if (isStream) {
              res.write(`data: ${JSON.stringify({ error: 'OpenRouter stream timed out (120s)' })}\n\n`);
              res.write('data: [DONE]\n\n');
            }
            res.end();
          }
        } catch (_) {}
      });

      proxyReq.on('error', (err) => {
        if (sessionId && dbActiveChatTasks[sessionId]) {
          markChatTaskInterrupted(sessionId, err.message || 'OpenRouter connection error');
        }
        // If client disconnected or socket was intentionally aborted, suppress error write-after-end
        if (clientDisconnected || res.writableEnded || res.destroyed) {
          return;
        }
        try {
          if (!res.headersSent) {
            return sendJSON(res, 503, { error: `OpenRouter Network Error: ${err.message}` });
          }
          if (isStream) {
            res.write(`data: ${JSON.stringify({ error: `OpenRouter Network Error: ${err.message}` })}\n\n`);
            res.write('data: [DONE]\n\n');
          }
          res.end();
        } catch (e) {}
      });

      proxyReq.write(postData);
      proxyReq.end();
    } catch (err) {
      // Pembersihan aman jika terjadi throw sinkron (ERR_INVALID_CHAR, payload error, socket write error)
      if (sessionId && dbActiveChatTasks[sessionId]) {
        try {
          if (dbActiveChatTasks[sessionId].proxyReq && !dbActiveChatTasks[sessionId].proxyReq.destroyed) {
            dbActiveChatTasks[sessionId].proxyReq.destroy();
          }
        } catch (_) {}
        delete dbActiveChatTasks[sessionId];
      }
      return sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ----------------------------------------------------
  // CLAUDE AI RESILIENCE: GET CHAT TASK STATUS
  // ----------------------------------------------------
  const chatStatusMatch = pathname.match(/^\/api\/chat\/status\/([a-zA-Z0-9_-]+)$/);
  if ((chatStatusMatch || pathname === '/api/chat/status') && method === 'GET') {
    const statusUserId = reqUserId;
    const sid = chatStatusMatch ? chatStatusMatch[1] : (reqUrl.searchParams.get('sessionId') || reqUrl.searchParams.get('id'));
    if (!sid) {
      const activeSessions = [];
      const recentlyCompletedSessions = [];
      const now = Date.now();

      for (const k of Object.keys(dbActiveChatTasks)) {
        const t = dbActiveChatTasks[k];
        if (!t) continue;
        // PRIVACY ENFORCEMENT: Only include tasks for the requesting user!
        if (t.userId && t.userId !== statusUserId) {
          continue;
        }
        if (t.status === 'streaming') {
          activeSessions.push({ sessionId: t.sessionId, model: t.model, startedAt: t.startedAt });
        } else if (t.status === 'completed' && t.completedAt && (now - t.completedAt < 600000)) {
          recentlyCompletedSessions.push({ sessionId: t.sessionId, model: t.model, completedAt: t.completedAt });
        }
      }

      for (const rId of Object.keys(dbTugasRiset)) {
        const rTask = dbTugasRiset[rId];
        if (!rTask) continue;
        // PRIVACY ENFORCEMENT: Only include research tasks for the requesting user!
        if (rTask.userId && rTask.userId !== statusUserId) {
          continue;
        }
        if (rTask.status === 'sedang_meneliti' && rTask.sessionId) {
          if (!activeSessions.some(s => s.sessionId === rTask.sessionId)) {
            activeSessions.push({ sessionId: rTask.sessionId, isDeepResearch: true, model: 'Deep Research Pro', startedAt: rTask.createdAt });
          }
        } else if (rTask.status === 'selesai' && rTask.sessionId) {
          if (!recentlyCompletedSessions.some(s => s.sessionId === rTask.sessionId)) {
            recentlyCompletedSessions.push({ sessionId: rTask.sessionId, isDeepResearch: true, model: 'Deep Research Pro', completedAt: rTask.completedAt });
          }
        }
      }

      return sendJSON(res, 200, {
        active: activeSessions.length > 0,
        activeSessions,
        recentlyCompletedSessions
      });
    }

    // Dukungan delta polling: ?since=<offset byte ≥ 0> → kirim hanya potongan
    // baru dari fullText (hemat bandwidth untuk jawaban panjang yang di-poll).
    const sinceRaw = reqUrl.searchParams.get('since');
    const sinceNum = (sinceRaw !== null && sinceRaw !== '') ? Number(sinceRaw) : NaN;
    const sinceValid = Number.isFinite(sinceNum) && sinceNum >= 0;
    const sinceOffset = sinceValid ? Math.floor(sinceNum) : 0;

    // Kontrak epoch truncation: ?epoch=<nomor epoch klien>. Truncation memotong
    // teks dari DEPAN sehingga semua offset byte bergeser — delta HANYA boleh
    // dikirim bila epoch klien COCOK dengan epoch task saat ini. Klien lama yang
    // tidak mengirim epoch otomatis mendapat teks penuh (reset aman, tanpa
    // salah-sambung).
    const epochRaw = reqUrl.searchParams.get('epoch');
    const epochNum = (epochRaw !== null && epochRaw !== '') ? Number(epochRaw) : NaN;
    const clientEpochValid = Number.isFinite(epochNum) && epochNum >= 0;

    const buildTaskStatusPayload = (t) => {
      const taskText = t.fullText || '';
      const taskBytes = (typeof t.fullBytes === 'number') ? t.fullBytes : Buffer.byteLength(taskText, 'utf8');
      const taskEpoch = (typeof t.fullEpoch === 'number') ? t.fullEpoch : 0;
      const out = {
        active: t.status === 'streaming',
        status: t.status,
        sessionId: t.sessionId,
        model: t.model,
        text: taskText,
        fullBytes: taskBytes,
        fullEpoch: taskEpoch,
        startedAt: t.startedAt,
        completedAt: t.completedAt || null,
        error: t.error || null
      };
      // Delta hanya valid bila: since valid, epoch klien cocok, DAN offset masih
      // dalam rentang teks. Epoch beda (truncation menggeser offset) atau
      // since > fullBytes → teks penuh tanpa delta agar klien me-reset buffer
      // dengan aman.
      if (sinceValid && clientEpochValid && epochNum === taskEpoch && taskBytes >= sinceOffset) {
        out.text = Buffer.from(taskText, 'utf8').slice(sinceOffset).toString('utf8');
        out.delta = true;
      }
      return out;
    };

    const task = dbActiveChatTasks[sid];
    if (task && (task.status === 'streaming' || task.status === 'completed')) {
      // PRIVACY ENFORCEMENT: If task belongs to another user, deny access!
      if (task.userId && task.userId !== statusUserId) {
        return sendJSON(res, 200, { active: false, status: 'none', sessionId: sid });
      }
      return sendJSON(res, 200, buildTaskStatusPayload(task));
    }

    // Periksa apakah ada tugas Deep Research aktif atau baru selesai untuk sesi ini
    const matchingResearchTasks = [];
    for (const rId of Object.keys(dbTugasRiset)) {
      const rTask = dbTugasRiset[rId];
      if (rTask && (rTask.sessionId === sid || rTask.taskId === sid)) {
        if (!rTask.userId || rTask.userId === statusUserId) {
          matchingResearchTasks.push(rTask);
        }
      }
    }

    if (matchingResearchTasks.length > 0) {
      // Prioritaskan tugas yang sedang aktif/meneliti terlebih dahulu
      let rTask = matchingResearchTasks.find(t => t.status === 'sedang_meneliti');
      if (!rTask) {
        // Jika tidak ada yang sedang aktif, ambil tugas terbaru berdasarkan completedAt atau createdAt
        matchingResearchTasks.sort((a, b) => new Date(b.completedAt || b.createdAt || 0) - new Date(a.completedAt || a.createdAt || 0));
        rTask = matchingResearchTasks[0];
      }

      if (rTask.status === 'sedang_meneliti') {
        return sendJSON(res, 200, {
          active: true,
          status: 'streaming',
          isDeepResearch: true,
          taskId: rTask.taskId,
          sessionId: sid,
          model: 'Deep Research Pro',
          text: rTask.hasil || rTask.currentStep || 'Sedang meneliti di latar belakang...',
          startedAt: rTask.createdAt,
          completedAt: null,
          error: null
        });
      }
      if (rTask.status === 'selesai') {
        return sendJSON(res, 200, {
          active: false,
          status: 'completed',
          isDeepResearch: true,
          taskId: rTask.taskId,
          sessionId: sid,
          model: 'Deep Research Pro',
          text: rTask.hasil || '',
          chatSummary: rTask.chatSummary || '',
          sources: rTask.sources || [],
          startedAt: rTask.createdAt,
          completedAt: rTask.completedAt || new Date().toISOString(),
          error: null
        });
      }
      if (rTask.status === 'dibatalkan') {
        return sendJSON(res, 200, {
          active: false,
          status: 'aborted',
          isDeepResearch: true,
          taskId: rTask.taskId,
          sessionId: sid,
          model: 'Deep Research Pro',
          text: rTask.hasil || rTask.currentStep || 'Riset dihentikan oleh pengguna.',
          startedAt: rTask.createdAt,
          completedAt: rTask.completedAt || new Date().toISOString(),
          error: null
        });
      }
      if (rTask.status === 'gagal') {
        return sendJSON(res, 200, {
          active: false,
          status: 'error',
          isDeepResearch: true,
          taskId: rTask.taskId,
          sessionId: sid,
          model: 'Deep Research Pro',
          text: rTask.currentStep || '',
          startedAt: rTask.createdAt,
          completedAt: rTask.completedAt || new Date().toISOString(),
          error: rTask.error || 'Terjadi kesalahan pada riset mendalam.'
        });
      }
    }

    if (task) {
      return sendJSON(res, 200, buildTaskStatusPayload(task));
    }

    return sendJSON(res, 200, { active: false, status: 'none', sessionId: sid });
  }

  // ----------------------------------------------------
  // CLAUDE AI RESILIENCE: STOP ACTIVE CHAT TASK
  // ----------------------------------------------------
  if ((pathname === '/api/chat/stop' || pathname.startsWith('/api/chat/stop/')) && method === 'POST') {
    try {
      const body = await safeParseBody(req);
      if (!body) return;
      const urlSid = pathname.startsWith('/api/chat/stop/') ? pathname.split('/')[4] : null;
      const sid = body.sessionId || urlSid || reqUrl.searchParams.get('sessionId');
      const stopUserId = reqUserId;
      let stoppedAny = false;

      if (sid && dbActiveChatTasks[sid] && dbActiveChatTasks[sid].status === 'streaming') {
        const task = dbActiveChatTasks[sid];
        if (!task.userId || task.userId === stopUserId) {
          task.status = 'aborted';
          if (task.proxyReq && !task.proxyReq.destroyed) {
            try { task.proxyReq.destroy(); } catch (_) {}
          }
          if (task.rawBuffer) {
            flushChatTaskBuffer(sid, task.provider || 'openrouter');
          }
          // Simpan potongan yang sudah terlanjur dibuat
          if (task.fullText && task.fullText.trim()) {
            appendAssistantMessageToSessionDisk(sid, task.fullText + '\n\n*[Respons dihentikan oleh pengguna]*', task.model)
              .catch(err => console.warn('Gagal simpan respons terhenti ke sesi:', err && err.message));
          }
          // Buang task dari map AGAR polling /api/chat/status tidak terus
          // mengembalikan status 'aborted' untuk sesi yang sudah dihentikan
          delete dbActiveChatTasks[sid];
          stoppedAny = true;
        }
      }

      // Hentikan juga tugas Deep Research aktif untuk sesi ini jika ada
      if (sid) {
        for (const rId of Object.keys(dbTugasRiset)) {
          const rTask = dbTugasRiset[rId];
          if (rTask && (rTask.sessionId === sid || rTask.taskId === sid || rTask.taskId === body.taskId) && rTask.status === 'sedang_meneliti') {
            if (!rTask.userId || rTask.userId === stopUserId) {
              rTask.aborted = true;
              rTask.status = 'dibatalkan';
              rTask.currentStep = 'Riset dihentikan oleh pengguna.';
              rTask.completedAt = new Date().toISOString();
              stoppedAny = true;
            }
          }
        }
      }

      return sendJSON(res, 200, { success: true, message: stoppedAny ? 'Tugas chat/riset berhasil dihentikan' : 'Tidak ada tugas aktif untuk sesi ini' });
    } catch (stopErr) {
      return sendJSON(res, 500, { error: stopErr.message });
    }
  }

  // --- GUARD UNMATCHED API ROUTES (Prevent SPA HTML fallback for missing API endpoints) ---
  if (pathname.startsWith('/api/')) {
    return sendJSON(res, 404, {
      error: `Endpoint API '${pathname}' [${method}] tidak ditemukan atau metode tidak didukung.`
    });
  }

  // --- STATIC FILE SERVING ---
  if (method !== 'GET' && method !== 'HEAD') {
    return sendJSON(res, 405, { error: 'Method Not Allowed' });
  }

  // --- VERCEL SERVERLESS GUARD ---
  // Di Vercel Serverless, static files dilayani langsung oleh Edge CDN. Function ini hanya melayani /api/*
  if (IS_VERCEL_ENV) {
    return sendJSON(res, 404, { error: 'API endpoint not found on Vercel Gateway', path: pathname });
  }

  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (e) {
    return sendJSON(res, 400, { error: 'Bad Request: Malformed URI sequence' });
  }

  let safePath = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, safePath);

  // Security check: prevent path traversal outside public
  const relative = path.relative(PUBLIC_DIR, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return sendJSON(res, 403, { error: 'Forbidden: Path traversal detected' });
  }

  fs.stat(filePath, (err, stats) => {
    if (res.headersSent || res.writableEnded || res.destroyed) return;
    if (err || !stats.isFile()) {
      // Fallback for SPA routing to index.html if file doesn't exist
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.stat(indexPath, (idxStatErr, idxStats) => {
        if (res.headersSent || res.writableEnded || res.destroyed) return;
        if (idxStatErr || !idxStats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
        // ETag fallback index → 304 murah, tapi index.html selalu revalidasi (no-cache)
        const idxEtag = '"' + idxStats.mtimeMs + '-' + idxStats.size + '"';
        if (req.headers['if-none-match'] === idxEtag) {
          res.writeHead(304, { 'ETag': idxEtag, 'Cache-Control': 'no-cache' });
          return res.end();
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': idxStats.size,
          'Cache-Control': 'no-cache',
          'ETag': idxEtag
        });
        if (method === 'HEAD') return res.end();
        // F20: streaming langsung dari disk — tanpa memuat seluruh file ke memori
        // (models.json ~782KB per permintaan; file besar menghasilkan puncak RAM N×).
        const idxStream = fs.createReadStream(indexPath);
        idxStream.on('error', (err) => {
          console.error('[Static Index Stream Error]:', err?.message || err);
          if (!res.headersSent && !res.destroyed) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Gagal membaca berkas statis' }));
          } else if (!res.destroyed) {
            try { res.destroy(); } catch (_) {}
          }
        });
        if (res.writableEnded || res.destroyed) { idxStream.destroy(); return; }
        idxStream.pipe(res);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // ETag berbasis mtime+size: SEMUA aset (html maupun non-html) memakai no-cache
    // = SELALU revalidasi ke server. Respons 304 (ETag cocok) nyaris gratis, jadi
    // tidak ada gunanya max-age di aplikasi lokal yang file-nya sering diedit —
    // dulu max-age=3600 membuat browser menyajikan app.js LAMA hingga 1 jam bahkan
    // setelah refresh biasa (gejala: fix tidak pernah terlihat sampai Ctrl+F5).
    const etag = '"' + stats.mtimeMs + '-' + stats.size + '"';
    const cacheControl = 'no-cache';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { 'ETag': etag, 'Cache-Control': cacheControl, 'Vary': 'Accept-Encoding' });
      return res.end();
    }

    // Gzip: hanya konten kompresibel > 1KB dan bila klien mendukung
    const acceptsGzip = String(req.headers['accept-encoding'] || '').toLowerCase().includes('gzip');
    const mimeBase = contentType.split(';')[0].trim().toLowerCase(); // buang "; charset=..."
    const isCompressible = mimeBase.startsWith('text/') ||
      mimeBase === 'application/javascript' ||
      mimeBase === 'application/json' ||
      mimeBase === 'image/svg+xml';
    const useGzip = acceptsGzip && isCompressible && stats.size > 1024;

    const resHeaders = {
      'Content-Type': contentType,
      'ETag': etag,
      'Cache-Control': cacheControl,
      // Vary WAJIB di SEMUA varian respons (identity maupun gzip, plus jalur 304
      // di atas) — bila hanya dipasang di respons gzip, cache intermediary bisa
      // menyimpan satu varian dan menyajikannya ke klien dengan Accept-Encoding
      // yang berbeda.
      'Vary': 'Accept-Encoding'
    };
    if (useGzip) {
      resHeaders['Content-Encoding'] = 'gzip';
      // Content-Length sengaja dihapus → transfer chunked (ukuran terkompresi beda)
    } else {
      resHeaders['Content-Length'] = stats.size;
    }
    res.writeHead(200, resHeaders);
    if (method === 'HEAD') return res.end();

    // F20: streaming dari disk, bukan readFile penuh ke memori.
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (err) => {
      console.error('[Static File Stream Error]:', err?.message || err);
      if (!res.headersSent && !res.destroyed) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gagal membaca berkas statis' }));
      } else if (!res.destroyed) {
        try { res.destroy(); } catch (_) {}
      }
    });
    if (res.writableEnded || res.destroyed) { fileStream.destroy(); return; }
    if (useGzip) {
      const gzipStream = zlib.createGzip({ level: 6 });
      gzipStream.on('error', (err) => {
        console.error('[Static Gzip Stream Error]:', err?.message || err);
        try { fileStream.destroy(); } catch (_) {}
        if (!res.destroyed) { try { res.destroy(); } catch (_) {}
        }
      });
      // Klien pergi di tengah jalan → buang kedua stream agar fd tidak bocor
      res.on('close', () => {
        try { fileStream.destroy(); } catch (_) {}
        try { gzipStream.destroy(); } catch (_) {}
      });
      fileStream.pipe(gzipStream).pipe(res);
    } else {
      fileStream.pipe(res);
    }
  });
}

const server = http.createServer(requestHandler);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} sedang digunakan oleh proses lain.`);
    console.error(`💡 Tip: Jalankan ZOZ ROUTER pada port lain dengan menentukan environment variable:`);
    console.error(`   PORT=${Number(PORT) + 1} node server.js\n`);
  } else {
    console.error('\n❌ Server Error:', err.message);
  }
  process.exit(1);
});

// Vercel Serverless: JANGAN pasang penangan uncaughtException / unhandledRejection
// di sana. Bila exception ditelan, proses tetap hidup tetapi respons tidak pernah
// dikirim, sehingga platform membunuh fungsi dan menampilkan
// "500 FUNCTION_INVOCATION_FAILED" tanpa keterangan apa pun. Di server lokal
// justru sebaliknya: kita ingin error tercatat rapi dan server tetap berjalan.
if (!IS_VERCEL_ENV) {
  process.on('unhandledRejection', (reason) => {
    console.warn('⚠️ Warning: Unhandled Promise Rejection ditangkap:', reason && (reason.stack || reason.message || reason));
  });

  process.on('uncaughtException', (err) => {
    console.error('⚠️ Critical: Uncaught Exception ditangkap:', err && (err.stack || err.message || err));
    // F19: permukaan observabilitas — kegagalan di luar request kini terlihat di
    // /api/health (proses tetap hidup agar server lokal tak mati karena satu error).
    lastUncaughtInfo = { at: new Date().toISOString(), message: String((err && err.message) || err) };
  });
}

process.on('SIGINT', () => {
  console.log('\n🛑 Menghentikan server ZOZ ROUTER secara anggun...');
  server.close(() => {
    process.exit(0);
  });
});

if (require.main === module && !process.env.VERCEL) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`⚡ ZOZ ROUTER - AI Multi-Engine Neural Gateway Active`);
    console.log(`======================================================`);
    console.log(`🌐 Local Web UI:    http://localhost:${PORT}`);
    console.log(`🦙 Ollama Gateway:  http://127.0.0.1:11434 (Local)`);
    console.log(`⚡ OpenRouter GW:   https://openrouter.ai/api/v1 (Cloud)`);
    console.log(`======================================================\n`);
  });
}

module.exports = server;
module.exports.requestHandler = requestHandler;
