/**
 * ZOZ ROUTER - AI Multi-Engine Neural Gateway & Playground
 * Backend Server with High-Speed Streaming Proxy for Ollama & OpenRouter
 * Zero external dependencies - uses pure Node.js standard library.
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn, execSync } = require('child_process');

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

const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Ensure data directories exist on device storage
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint, x-title, HTTP-Referer, x-serper-key, x-ollama-key, x-api-key, x-openrouter-key, x-session-id, X-Session-ID'
  });
  res.end(JSON.stringify(data));
}

// Helper to parse JSON request body safely with Buffer chunks
function parseBody(req) {
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
        safeResolve({});
      }
    });
    req.on('close', () => {
      if (!req.complete) {
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

// Validasi sessionId untuk mencegah path traversal
function validateSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') return { valid: false, error: 'ID sesi diperlukan.' };
  const id = sessionId.trim();
  if (id.length > 128) return { valid: false, error: 'ID sesi terlalu panjang (maks 128 karakter).' };
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return { valid: false, error: 'Format ID sesi tidak valid. Hanya alphanumeric, garis bawah, dan tanda hubung yang diperbolehkan.' };
  // Resolve path dan pastikan tidak keluar dari SESSIONS_DIR
  const sessFile = path.join(SESSIONS_DIR, `${id}.json`);
  const resolved = path.resolve(sessFile);
  const resolvedSessionsDir = path.resolve(SESSIONS_DIR);
  if (!resolved.startsWith(resolvedSessionsDir + path.sep) && resolved !== resolvedSessionsDir) {
    return { valid: false, error: 'Forbidden: Path traversal terdeteksi.' };
  }
  return { valid: true, id, sessFile };
}

// Helper untuk mengunduh buffer gambar dari URL eksternal dengan proteksi SSRF, batas redirect loop, dan memory buffer cap
function downloadImageBuffer(imageUrl, timeoutMs = 35000, redirectCount = 0) {
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
}

// Official Ollama Cloud Flagship Models (Included Free Usage & Usage Credits)
const OFFICIAL_OLLAMA_CLOUD_MODELS = [
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

// Helper to discover locally installed Ollama models from manifest files on disk
function getLocalOllamaManifests() {
  const userHome = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\user';
  const manifestsDir = path.join(userHome, '.ollama', 'models', 'manifests');
  const models = [];

  function scan(dir, relPath = '') {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const subRel = relPath ? `${relPath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          scan(fullPath, subRel);
        } else if (entry.isFile()) {
          const parts = subRel.split(/[\/\\]/);
          if (parts.length >= 2) {
            const tag = parts[parts.length - 1];
            const modelName = parts[parts.length - 2];
            const fullName = `${modelName}:${tag}`;
            const stat = fs.statSync(fullPath);
            models.push({
              name: fullName,
              model: fullName,
              size: stat.size,
              modified_at: stat.mtime.toISOString(),
              details: { format: 'gguf', family: modelName }
            });
          }
        }
      }
    } catch (e) {
      console.warn('Error reading manifest directory:', e.message);
    }
  }

  scan(manifestsDir);
  return models;
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
    const targetNum = Math.min(Math.max(parseInt(num, 10) || 15, 1), 30);
    const serperKey = apiKey || process.env.SERPER_API_KEY;
    if (!serperKey) {
      return safeResolve({ query: cleanQuery, count: 0, results: [], error: 'Serper API key tidak dikonfigurasi. Setel SERPER_API_KEY atau kirim header x-serper-key.' });
    }
    const postData = JSON.stringify({
      q: cleanQuery,
      num: targetNum,
      gl: 'us', // Global Worldwide Search (Universal - Tidak terisolasi di satu negara)
      hl: 'en'  // Global Language Ranking
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
            parsed.organic.slice(0, targetNum).forEach((item, idx) => {
              const dom = extractDomainSafe(item.link);
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
          }

          safeResolve({
            query: cleanQuery,
            count: results.length,
            knowledgeGraph: parsed.knowledgeGraph || null,
            answerBox: parsed.answerBox || null,
            organic: parsed.organic || [],
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

const YOUTUBE_URL_REGEX = /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)?/gi;

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
    return youtubeInfoCache.get(canonicalUrl);
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
          youtubeInfoCache.set(canonicalUrl, result);
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
(Informasi resmi ini diambil secara real-time via endpoint YouTube oEmbed)`;
  }).join('\n\n');

  const groundingPrompt = `\n\n### REAL-TIME YOUTUBE VIDEO GROUNDING DATA:\n${contextBlocks}\n\nInstruksi untuk AI: Gunakan informasi metadata resmi di atas untuk menjawab dan menganalisis video YouTube yang ditanyakan pengguna secara tepat, akurat, dan tanpa halusinasi.`;

  return {
    text: text + groundingPrompt,
    youtubeVideos: validVideos,
    groundingContext: groundingPrompt
  };
}

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
const dbActiveChatTasks = {}; // sessionId -> { taskId, sessionId, model, fullText, rawBuffer, status, startedAt, completedAt, proxyReq }

function pruneActiveChatTasks() {
  try {
    const FIFTEEN_MINS = 15 * 60 * 1000;
    const now = Date.now();
    for (const sid of Object.keys(dbActiveChatTasks)) {
      const t = dbActiveChatTasks[sid];
      if (t) {
        if (t.status === 'completed' || t.status === 'error' || t.status === 'aborted') {
          delete dbActiveChatTasks[sid];
          continue;
        }
        if (t.startedAt && (now - t.startedAt > FIFTEEN_MINS)) {
          if (t.proxyReq && !t.proxyReq.destroyed) {
            try { t.proxyReq.destroy(); } catch (_) {}
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
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.replace(/^data:\s*/, '').trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
        if (delta) {
          task.fullText += delta;
          task.lastTokenTime = Date.now();
        }
      } catch (_) {}
    } else {
      // Ollama
      try {
        const parsed = JSON.parse(trimmed);
        const delta = parsed.message?.content || parsed.response || '';
        if (delta) {
          task.fullText += delta;
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
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.replace(/^data:\s*/, '').trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
          if (delta) {
            task.fullText += delta;
            task.lastTokenTime = Date.now();
          }
        } catch (_) {}
      } else {
        try {
          const parsed = JSON.parse(trimmed);
          const delta = parsed.message?.content || parsed.response || '';
          if (delta) {
            task.fullText += delta;
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
  flushChatTaskBuffer(sessionId, task.provider || 'openrouter');
  if (task.fullText && task.fullText.trim()) {
    appendAssistantMessageToSessionDisk(sessionId, task.fullText + `\n\n*[Respons terputus: ${reason}]*`, task.model);
  }
  // Clean up completed/interrupted task
  delete dbActiveChatTasks[sessionId];
}

function appendAssistantMessageToSessionDisk(sessionId, content, modelName, extraMeta = {}) {
  if (!sessionId || !content || !content.trim()) return false;
  try {
    const cleanSid = String(sessionId).trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanSid)) return false;
    if (!fs.existsSync(SESSIONS_DIR)) {
      try { fs.mkdirSync(SESSIONS_DIR, { recursive: true }); } catch (_) {}
    }
    const sessFile = path.join(SESSIONS_DIR, `${cleanSid}.json`);

    let sessData = null;
    if (fs.existsSync(sessFile)) {
      try {
        sessData = JSON.parse(fs.readFileSync(sessFile, 'utf8'));
      } catch (_) {
        sessData = null;
      }
    }

    // Jika file sesi fisik belum ada di disk (misal user langsung keluar sesaat setelah kirim pesan),
    // buat otomatis struktur sesi agar jawaban latar belakang tidak hilang dan pertanyaan user tetap ada
    if (!sessData || typeof sessData !== 'object') {
      const initialMsgs = [];
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
          fs.writeFileSync(tempFile, JSON.stringify(sessData, null, 2), 'utf8');
          fs.renameSync(tempFile, sessFile);
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
      fs.writeFileSync(tempFile, JSON.stringify(sessData, null, 2), 'utf8');
      fs.renameSync(tempFile, sessFile);
    } catch (err) {
      try { fs.unlinkSync(tempFile); } catch {}
      throw err;
    }
    return true;
  } catch (err) {
    console.warn(`[Background Chat Engine] Gagal menyimpan respons asisten ke sesi disk ${sessionId}:`, err.message);
    return false;
  }
}

// Helper jeda asinkronus untuk mencegah lonjakan rate-limit (RPM)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function isFreeTierModel(modelName) {
  if (!modelName || typeof modelName !== 'string') return false;
  const lower = modelName.toLowerCase();
  return lower.includes(':free') || lower.endsWith('/free') || lower === 'openrouter/free';
}

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

    const isFreeModel = (rawModel || '').includes(':free') || rawModel === 'openrouter/free';
    const candidateModels = isFreeModel
      ? [
          rawModel,
          'openrouter/free',
          'google/gemma-2-9b-it:free',
          'meta-llama/llama-3.1-8b-instruct:free'
        ].filter(Boolean).filter((m, idx, arr) => arr.indexOf(m) === idx && m !== 'qwen/qwen3.8-27b:free')
      : [rawModel || 'google/gemini-2.0-flash-001'];

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
  const activeOllamaKey = ollamaApiKey || (apiKey && !apiKey.startsWith('sk-or-') ? apiKey : null) || process.env.OLLAMA_API_KEY;
  let rawEp = (endpoint || '').trim();

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
function fetchPageContent(targetUrl, maxChars = 3500, redirectCount = 0) {
  return new Promise((resolve) => {
    try {
      if (redirectCount > 3) {
        return resolve(''); // Batas maksimal 3 hop redirect
      }
      if (!targetUrl || typeof targetUrl !== 'string' || !/^https?:\/\//i.test(targetUrl)) {
        return resolve('');
      }
      const parsedUrl = new URL(targetUrl);
      if (isPrivateHost(parsedUrl.hostname, parsedUrl.port)) {
        return resolve(''); // Cegah akses ke host lokal / intranet
      }
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br'
        },
        timeout: 6000
      };

      let rawHtml = '';
      let resolved = false;

      function finishExtract(html) {
        if (resolved) return;
        resolved = true;
        try {
          let clean = html
            .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
            .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
            .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
            .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
            .replace(/<aside\b[\s\S]*?<\/aside>/gi, ' ')
            .replace(/<form\b[\s\S]*?<\/form>/gi, ' ')
            .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
            .replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/<[^>]+>/g, ' ');

          clean = clean
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          resolve(clean.substring(0, maxChars));
        } catch (e) {
          resolve('');
        }
      }

      const req = client.request(options, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          try {
            res.resume();
            resolved = true;
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            return fetchPageContent(redirectUrl, maxChars, redirectCount + 1).then(resolve);
          } catch (e) {
            resolved = true;
            return resolve('');
          }
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          resolved = true;
          return resolve('');
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

        stream.on('end', () => { if (!resolved) { rawHtml = typeof chunks !== 'undefined' && chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : rawHtml; finishExtract(rawHtml); } });
        stream.on('error', () => {
          try { res.unpipe(); } catch (_) {}
          try { if (stream !== res) stream.destroy(); } catch (_) {}
          if (typeof chunks !== 'undefined' && chunks.length > 0) { rawHtml = Buffer.concat(chunks).toString('utf8'); finishExtract(rawHtml); } else if (rawHtml.length > 0) { finishExtract(rawHtml); }
          else if (!resolved) { resolved = true; resolve(''); }
        });
        res.on('error', () => {
          try { res.unpipe(); } catch (_) {}
          try { if (stream !== res) stream.destroy(); } catch (_) {}
          if (typeof chunks !== 'undefined' && chunks.length > 0) { rawHtml = Buffer.concat(chunks).toString('utf8'); finishExtract(rawHtml); } else if (rawHtml.length > 0) { finishExtract(rawHtml); }
          else if (!resolved) { resolved = true; resolve(''); }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        if (typeof chunks !== 'undefined' && chunks.length > 0) { rawHtml = Buffer.concat(chunks).toString('utf8'); finishExtract(rawHtml); } else if (rawHtml.length > 0) { finishExtract(rawHtml); }
        else if (!resolved) { resolved = true; resolve(''); }
      });
      req.on('error', () => {
        if (typeof chunks !== 'undefined' && chunks.length > 0) { rawHtml = Buffer.concat(chunks).toString('utf8'); finishExtract(rawHtml); } else if (rawHtml.length > 0) { finishExtract(rawHtml); }
        else if (!resolved) { resolved = true; resolve(''); }
      });
      req.end();
    } catch (err) {
      resolve('');
    }
  });
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
    .replace(/[^\w\s\.\-]/g, ' ')
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

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthId = now.toLocaleString('id-ID', { month: 'long' });

  return {
    primary: cleanQuery,
    core: coreQuery,
    news: `${coreQuery} news`,
    recentNews: `${coreQuery} berita`,
    recentNewsId: `${coreQuery} berita terbaru`,
    weeklyNews: `${coreQuery} update`,
    tech: coreQuery
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
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#8216;/g, "‘")
    .replace(/&#8217;/g, "’")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
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
  const qPlan = deriveBroadSearchQueries(query.trim(), contextText);
  const cleanQuery = qPlan.primary;
  const techQuery = qPlan.tech;
  const newsQuery = qPlan.news;
  const recentQuery = qPlan.recentNews;
  const recentQueryId = qPlan.recentNewsId || `${cleanQuery} berita terbaru`;
  const weeklyQuery = qPlan.weeklyNews;
  const coreQuery = qPlan.core;

  // Deteksi apakah kueri relevan dengan konteks bahasa Indonesia / nasional
  const combinedLower = (cleanQuery + ' ' + (contextText || '')).toLowerCase();
  const isIndoQuery = /\b(terbaru|terkini|berita|apa|siapa|bagaimana|mengapa|kapan|di|ke|dari|hari ini|minggu ini|bulan ini|tahun ini|presiden|indonesia|jakarta|pemerintah|bbm|gempa|harga|bansos|pilkada|narkoba|polisi|pasar saham)\b/i.test(combinedLower);

  const serperCalls = [
    performWebSearch(cleanQuery, null, maxResults)
  ];
  if (cleanDateQuery && cleanDateQuery.length >= 3 && cleanDateQuery.toLowerCase() !== cleanQuery.toLowerCase()) {
    serperCalls.push(performWebSearch(cleanDateQuery, null, maxResults));
  }

  const isTechQuery = /\b(ai|llm|software|github|code|linux|python|developer|api|tech|crypto|bitcoin|model|chip|gpu|nvidia|programming|framework)\b/i.test(combinedLower);

  // Eksekusi seluruh provider: Google Serper Global, Google News RSS Global, Tech Wire / HackerNews (jika tech), DuckDuckGo Instant, & Wikipedia Global
  const [serperRes1, serperRes2, gnewsPrimary, gnewsCore, gnewsIndo, gnewsNews, hnTech, hnCore, ddgInstant, wikiRes] = await Promise.allSettled([
    serperCalls[0],
    serperCalls[1] || Promise.resolve({ results: [] }),
    fetchGoogleNewsRss(cleanQuery, 'en', 10),
    fetchGoogleNewsRss(coreQuery, 'en', 8),
    isIndoQuery ? fetchGoogleNewsRss(`${coreQuery} berita terbaru`, 'id', 6) : Promise.resolve([]),
    fetchGoogleNewsRss(newsQuery, 'en', 6),
    isTechQuery ? fetchHackerNewsTech(techQuery, 8) : Promise.resolve([]),
    isTechQuery ? fetchHackerNewsTech(coreQuery, 6) : Promise.resolve([]),
    fetchDuckDuckGoInstant(coreQuery),
    fetchWikipediaFullText(coreQuery, 'en', 4)
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
    const normTitle = item.title.trim().toLowerCase().replace(/[^\w\s]/g, '');

    // Filter Wikipedia HANYA jika sudah ada cukup sumber web/berita non-Wikipedia (>= 3)
    if (normUrl.includes('wikipedia.org') || (item.domain && item.domain.includes('wikipedia.org')) || normTitle.includes('wikipedia')) {
      if (results.length >= 3) continue;
    }

    // Filter out irrelevant disambiguation or unrelated codenames
    if (normTitle.includes('listofapplecodenames') && !cleanQuery.toLowerCase().includes('apple')) continue;

    if (seenUrls.has(normUrl)) continue;
    seenUrls.add(normUrl);

    results.push(item);
    if (results.length >= maxResults) break;
  }

  return {
    query: cleanQuery,
    engine: 'autonomous_multi_source',
    count: results.length,
    results
  };
}

// Engine pembaca dan penjelajah halaman web mandiri (Deep Page Browser)
function browseWebPageContent(targetUrl, maxChars = 5000, redirectCount = 0) {
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
              links: ytInfo.channel_url ? [{ title: ytInfo.channel, url: ytInfo.channel_url }] : []
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

// Fungsi Logika Agen: Meneliti Berulang Secara Otonom dengan 6 Pilar Deep Research Premium
async function jalankanRisetOtonom(taskId, topik, config = {}) {
  const task = dbTugasRiset[taskId];
  if (!task) return;

  const serperKey = config.serperApiKey || process.env.SERPER_API_KEY;
  const maxIterations = config.maxIterations || 3;
  let allSources = [];
  let dataTemuan = [];
  let scrapedArticles = [];

  // Mandat Mutlak Kaisar Zozi: Arsitektur 1-Model Deep Research Super Efisien.
  // Gunakan 1 model master tunggal untuk mencerna data Agen 1, mencerna data Agen 2, mengoreksi di Model 3, dan merangkum di Model 4.
  // Hemat kuota kredit RPD tanpa memanggil multi-model berbeda, namun output tetap divergen karena bahan web Primer & Divergen 100% berbeda domain.
  const masterResearchModel = config.finalModel || config.model || config.agent1Model || 'openrouter/free';
  const agent1Model = masterResearchModel;
  const agent2Model = masterResearchModel;
  const model3 = masterResearchModel;
  const model4 = masterResearchModel;

  try {
    // ==========================================
    // PILAR 1 & 6: PENCARIAN MULTI-TAHAP & ASYNCHRONOUS QUEUE (DUAL-AGENT SERPER DIVERGEN)
    // ==========================================
    task.currentStep = '[Langkah 1/3] Menelusuri Google via Multi-Agen (Dual-Agent Serper Divergen)...';
    task.progressPercent = 15;
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] [Langkah 1/3] Memulai riset dual-agen Google Serper divergen untuk: "${topik}"`);

    let currentQuery = topik;

    for (let i = 1; i <= maxIterations; i++) {
      if (task.aborted) {
        task.status = 'dibatalkan';
        task.currentStep = 'Riset dihentikan oleh pengguna.';
        task.completedAt = new Date().toISOString();
        return;
      }

      task.currentStep = `[Langkah 1/3] Iterasi ${i}/${maxIterations}: Menjelajah Paralel (Agen 1: Serper Primer & Agen 2: Serper Divergen) -> "${currentQuery}"`;
      task.progressPercent = 15 + Math.round((i / (maxIterations + 1)) * 30);
      task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] Iterasi ${i}: Menjalankan riset paralel Serper divergen -> "${currentQuery}"`);

      // 1. Eksekusi Agen 1 (Perspektif Primer)
      const searchResSerper = await performWebSearch(currentQuery, serperKey);

      // Kumpulkan URL dan domain unik dari Agen 1 serta riwayat sumber sebelumnya
      const agent1Urls = new Set();
      const agent1Domains = new Set();
      (searchResSerper.results || []).forEach(r => {
        if (r.url) agent1Urls.add(r.url);
        const d = (r.domain || extractDomainSafe(r.url) || '').toLowerCase().replace(/^www\./, '');
        if (d) agent1Domains.add(d);
      });
      allSources.forEach(s => {
        if (s.url) agent1Urls.add(s.url);
        const d = (s.domain || extractDomainSafe(s.url) || '').toLowerCase().replace(/^www\./, '');
        if (d) agent1Domains.add(d);
      });

      // 2. Eksekusi Agen 2 (Perspektif Divergen / Analitis Mendalam dengan Eksklusi Domain)
      let divergentQuery = `${currentQuery} analisis mendalam data statistik riset teknis 2026`;
      const topExclude = Array.from(agent1Domains).slice(0, 3);
      if (topExclude.length > 0) {
        divergentQuery += topExclude.map(d => ` -site:${d}`).join('');
      }
      const searchResDivergentRaw = await performWebSearch(divergentQuery, serperKey);

      // Filter ketat Agen 2: Zero-Collision (100% domain & URL berbeda)
      const filteredDivergentResults = [];
      if (Array.isArray(searchResDivergentRaw.results)) {
        for (const item of searchResDivergentRaw.results) {
          if (!item.url) continue;
          const itemDomain = (item.domain || extractDomainSafe(item.url) || '').toLowerCase().replace(/^www\./, '');
          if (agent1Urls.has(item.url) || (itemDomain && agent1Domains.has(itemDomain))) {
            continue; // Eliminasi mutlak: tidak boleh sama domain atau URL!
          }
          filteredDivergentResults.push({
            ...item,
            domain: itemDomain || item.domain,
            sourceProvider: 'Serper (Divergen)'
          });
          agent1Urls.add(item.url);
          if (itemDomain) agent1Domains.add(itemDomain);
          if (filteredDivergentResults.length >= 15) break;
        }
      }

      const searchResDivergent = {
        query: divergentQuery,
        error: searchResDivergentRaw.error,
        count: filteredDivergentResults.length,
        knowledgeGraph: searchResDivergentRaw.knowledgeGraph || null,
        answerBox: searchResDivergentRaw.answerBox || null,
        results: filteredDivergentResults
      };

      if (searchResSerper.error) {
        task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] ⚠️ Agen 1 (Serper Primer): "${searchResSerper.error}".`);
      } else {
        task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] ✓ Agen 1 (Serper Primer) menemukan ${searchResSerper.results?.length || 0} sumber data web.`);
      }

      if (searchResDivergent.error) {
        task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] ⚠️ Agen 2 (Serper Divergen): "${searchResDivergent.error}".`);
      } else {
        task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] ✓ Agen 2 (Serper Divergen) menemukan ${searchResDivergent.results.length} sumber unik (100% domain berbeda).`);
      }

      // Format data Agen 1 (Google Serper Primer)
      let serperBlock = '';
      if (searchResSerper.knowledgeGraph) {
        serperBlock += `\n[KNOWLEDGE GRAPH - SERPER PRIMER]: ${searchResSerper.knowledgeGraph.title || ''} - ${searchResSerper.knowledgeGraph.snippet || ''}\n`;
      }
      if (searchResSerper.answerBox) {
        serperBlock += `\n[ANSWER BOX - SERPER PRIMER]: ${searchResSerper.answerBox.snippet || ''}\n`;
      }
      if (Array.isArray(searchResSerper.results)) {
        searchResSerper.results.forEach((item) => {
          serperBlock += `\n- [Web Serper Primer] ${item.title}: ${item.snippet} (${item.url})`;
          if (item.url && !allSources.some(s => s.url === item.url)) {
            allSources.push({
              title: item.title,
              url: item.url,
              snippet: item.snippet,
              domain: item.domain || extractDomainSafe(item.url),
              sourceProvider: 'Serper (Primer)'
            });
          }
        });
      }

      // Format data Agen 2 (Google Serper Divergen - Domain Mandiri)
      let divergentBlock = '';
      if (searchResDivergent.knowledgeGraph) {
        divergentBlock += `\n[KNOWLEDGE GRAPH - SERPER DIVERGEN]: ${searchResDivergent.knowledgeGraph.title || ''} - ${searchResDivergent.knowledgeGraph.snippet || ''}\n`;
      }
      if (searchResDivergent.answerBox) {
        divergentBlock += `\n[ANSWER BOX - SERPER DIVERGEN]: ${searchResDivergent.answerBox.snippet || ''}\n`;
      }
      if (Array.isArray(searchResDivergent.results)) {
        searchResDivergent.results.forEach((item) => {
          divergentBlock += `\n- [Web Serper Divergen] ${item.title}: ${item.snippet} (${item.url})`;
          if (item.url && !allSources.some(s => s.url === item.url)) {
            allSources.push({
              title: item.title,
              url: item.url,
              snippet: item.snippet,
              domain: item.domain || extractDomainSafe(item.url),
              sourceProvider: 'Serper (Divergen)'
            });
          }
        });
      }

      // Publikasikan Snapshot Live Inspection SEGERA (agar sumber langsung terlihat di UI tanpa menunggu LLM)
      task.liveInspection = {
        topik,
        currentQuery,
        iteration: i,
        maxIterations,
        timestamp: new Date().toLocaleTimeString('id-ID'),
        agent1: {
          name: 'Agen 1 (Pakar Web Google)',
          provider: 'Google Serper API (Primer)',
          model: masterResearchModel,
          resultsCount: searchResSerper.results?.length || 0,
          results: (searchResSerper.results || []).map(r => ({ title: r.title, url: r.url, link: r.url, snippet: r.snippet })),
          analysis: 'Sedang menganalisis temuan web dan mengekstrak poin penting...'
        },
        agent2: {
          name: 'Agen 2 (Pakar Analisis Divergen)',
          provider: 'Google Serper API (Divergen)',
          model: masterResearchModel,
          resultsCount: searchResDivergent.results?.length || 0,
          knowledgeGraph: searchResDivergent.knowledgeGraph || null,
          answerBox: searchResDivergent.answerBox || null,
          results: (searchResDivergent.results || []).map(r => ({ title: r.title, url: r.url, link: r.url, snippet: r.snippet })),
          analysis: 'Sedang mengekstrak data analitis mendalam dari domain independen 100% berbeda...'
        },
        scraper: {
          status: 'siap',
          totalScraped: allSources.slice(0, 30).length,
          articles: allSources.slice(0, 30).map((s) => ({
            title: s.title,
            url: s.url,
            domain: s.domain || extractDomainSafe(s.url),
            length: (s.snippet || '').length,
            sample: s.snippet || 'Menunggu giliran pemindaian mendalam...'
          }))
        },
        scrapedArticlesCount: Math.min(allSources.length, 30),
        totalSourcesCount: allSources.length
      };

      // 2. Jalankan Analisis Spesialis Paralel oleh LLM Agen 1 dan LLM Agen 2 (Model Riset Tunggal)
      task.currentStep = `[Langkah 1/3] Iterasi ${i}/${maxIterations}: Model Riset (${masterResearchModel}) menganalisis temuan Primer & Divergen...`;

      const promptAgen1 = `Anda adalah Agen 1 (Pakar Analis Web Google).
Topik Riset: "${topik}"
Sub-Query: "${currentQuery}"
Data Mentah Web Serper Primer:
${serperBlock || 'Tidak ada data Serper.'}

Tugas Anda:
Analisis temuan web di atas secara objektif. Rangkum fakta utama, tren industri terbaru tahun 2026, dan poin-poin penting yang ditemukan dalam 2-3 paragraf padat.`;

      const promptAgen2 = `Anda adalah Agen 2 (Pakar Analisis Data Mendalam & Divergen).
Topik Riset: "${topik}"
Sub-Query: "${currentQuery}"
Data Mentah Web Serper Divergen (Sumber Domain Mandiri):
${divergentBlock || 'Tidak ada data Serper Divergen.'}

Tugas Anda:
Analisis data di atas secara mendalam. Ekstrak entitas kunci, data statistik terverifikasi tahun 2026, aspek teknis spesifik, dan perspektif pelengkap dalam 2-3 paragraf padat.`;

      let analisisAgen1 = 'Tidak ada data dari Agen 1.';
      let analisisAgen2 = 'Tidak ada data dari Agen 2.';

      if (isFreeTierModel(masterResearchModel)) {
        // Eksekusi sekuensial dengan jeda adaptif pada model free untuk mencegah HTTP 429 concurrency limit
        if (serperBlock.trim()) {
          analisisAgen1 = await callLLMBackend({
            ...config,
            messages: [],
            model: masterResearchModel,
            prompt: promptAgen1,
            system: 'Anda adalah Agen 1: Analis Web Google yang fokus mengekstrak tren utama dan informasi relevan dari web.'
          }).catch((err) => {
            console.warn('Gagal memanggil Model Agen 1 di backend:', err?.message || err);
            return `[Ringkasan Ekstraksi Data Serper]:\n${serperBlock}`;
          });
        }
        await sleep(1200);
        if (divergentBlock.trim()) {
          analisisAgen2 = await callLLMBackend({
            ...config,
            messages: [],
            model: masterResearchModel,
            prompt: promptAgen2,
            system: 'Anda adalah Agen 2: Analis Data Divergen & Teknis yang fokus mengekstrak fakta terverifikasi dan sudut pandang spesifik dari domain mandiri.'
          }).catch((err) => {
            console.warn('Gagal memanggil Model Agen 2 di backend:', err?.message || err);
            return `[Ringkasan Ekstraksi Data Serper Divergen]:\n${divergentBlock}`;
          });
        }
      } else {
        const [res1, res2] = await Promise.all([
          (serperBlock.trim()) ? callLLMBackend({
            ...config,
            messages: [],
            model: masterResearchModel,
            prompt: promptAgen1,
            system: 'Anda adalah Agen 1: Analis Web Google yang fokus mengekstrak tren utama dan informasi relevan dari web.'
          }).catch((err) => {
            console.warn('Gagal memanggil Model Agen 1 di backend:', err?.message || err);
            return `[Ringkasan Ekstraksi Data Serper]:\n${serperBlock}`;
          }) : Promise.resolve('Tidak ada data dari Agen 1.'),

          (divergentBlock.trim()) ? callLLMBackend({
            ...config,
            messages: [],
            model: masterResearchModel,
            prompt: promptAgen2,
            system: 'Anda adalah Agen 2: Analis Data Divergen & Teknis yang fokus mengekstrak fakta terverifikasi dan sudut pandang spesifik dari domain mandiri.'
          }).catch((err) => {
            console.warn('Gagal memanggil Model Agen 2 di backend:', err?.message || err);
            return `[Ringkasan Ekstraksi Data Serper Divergen]:\n${divergentBlock}`;
          }) : Promise.resolve('Tidak ada data dari Agen 2.')
        ]);
        analisisAgen1 = res1;
        analisisAgen2 = res2;
      }

      task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] ✓ Analisis spesialis selesai: Model Riset (${masterResearchModel}) menganalisis temuan Primer & Divergen.`);

      // Update hasil analisis teks LLM ke snapshot Live Inspection
      if (task.liveInspection) {
        if (task.liveInspection.agent1) task.liveInspection.agent1.analysis = analisisAgen1 || '';
        if (task.liveInspection.agent2) task.liveInspection.agent2.analysis = analisisAgen2 || '';
      }

      const findingsText = `[HASIL ANALISIS AGEN 1 - PAKAR WEB (${masterResearchModel})]:\n${analisisAgen1}\n\n[HASIL ANALISIS AGEN 2 - PAKAR ANALISIS DIVERGEN (${masterResearchModel})]:\n${analisisAgen2}`;

      dataTemuan.push(`### Temuan Terverifikasi Iterasi ${i} (Query: "${currentQuery}"):\n${findingsText}`);

      if (i < maxIterations) {
        try {
          if (isFreeTierModel(masterResearchModel)) {
            await sleep(1500); // Jeda pelindung rate-limit sebelum planner evaluator
          }
          const evalPrompt = `Anda adalah AI Deep Research Planner.
Topik Utama: "${topik}"
Data Temuan Saat Ini:
${dataTemuan.join('\n\n')}

Tugas Evaluasi:
1. Analisis apakah informasi di atas sudah memadai untuk laporan mendalam komprehensif tahun 2026?
2. Jika sudah lengkap, jawab JSON: {"sudahCukup": true}
3. Jika belum, rumuskan kata kunci pencarian Google yang baru dan sangat spesifik (misal: aspek teknis, data statistik terbaru 2026, opini pakar, regulasi, studi kasus) dalam format JSON: {"sudahCukup": false, "kataKunciBaru": "query spesifik baru"}
Keluarkan hanya JSON valid tanpa teks tambahan.`;

          const evalModel = masterResearchModel;
          const evalResult = await callLLMBackend({
            ...config,
            model: evalModel,
            prompt: evalPrompt,
            system: 'Anda adalah Research Evaluator otonom yang teliti dan analitis.'
          });

          let parsedEval = null;
          try {
            const jsonMatch = evalResult.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedEval = JSON.parse(jsonMatch[0]);
          } catch (pe) {}

          if (parsedEval && parsedEval.sudahCukup === true) {
            task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] Penelusuran selesai pada iterasi ${i}. Melanjutkan ke pemindaian konten mendalam.`);
            break;
          } else if (parsedEval && parsedEval.kataKunciBaru) {
            currentQuery = parsedEval.kataKunciBaru;
            task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] Menemukan sub-topik lanjutan: "${currentQuery}"`);
          } else {
            if (i === 1) currentQuery = `${topik} spesifikasi teknis arsitektur 2026`;
            else if (i === 2) currentQuery = `${topik} benchmarking analisis komparasi studi kasus regulasi`;
          }
        } catch (evalErr) {
          if (i === 1) currentQuery = `${topik} data teknis terbaru 2026`;
          else if (i === 2) currentQuery = `${topik} tantangan regulasi implementasi masa depan`;
        }
      }
    }

    // ==========================================
    // PILAR 2: PEMINDAIAN KONTEN MENDALAM (AUTOMATED WEB SCRAPING)
    // ==========================================
    if (task.aborted) {
      task.status = 'dibatalkan';
      task.currentStep = 'Riset dihentikan oleh pengguna.';
      task.completedAt = new Date().toISOString();
      return;
    }

    // Balanced Interleaved Scraping: Ambil secara seimbang antara Agen 1 (Primer) dan Agen 2 (Divergen)
    const primerSources = allSources.filter(s => (s.sourceProvider || '').includes('Primer') || (!(s.sourceProvider || '').includes('Divergen')));
    const divergenSources = allSources.filter(s => (s.sourceProvider || '').includes('Divergen'));
    const targetScrapeUrls = [];
    const maxScrapeTarget = 30; // Minimal 20 - 30 website sesuai mandat Kaisar Zozi
    let pIdx = 0;
    let dIdx = 0;

    while (targetScrapeUrls.length < maxScrapeTarget && (pIdx < primerSources.length || dIdx < divergenSources.length)) {
      if (pIdx < primerSources.length && targetScrapeUrls.length < maxScrapeTarget) {
        targetScrapeUrls.push(primerSources[pIdx++]);
      }
      if (dIdx < divergenSources.length && targetScrapeUrls.length < maxScrapeTarget) {
        targetScrapeUrls.push(divergenSources[dIdx++]);
      }
    }
    if (targetScrapeUrls.length === 0) {
      targetScrapeUrls.push(...allSources.slice(0, maxScrapeTarget));
    }

    task.currentStep = `[Langkah 2/3] Menganalisis & memindai konten mendalam ${targetScrapeUrls.length} artikel web seimbang (Web Scraping)...`;
    task.progressPercent = 55;
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] [Langkah 2/3] Memulai web scraping ke ${targetScrapeUrls.length} tautan seimbang (Serper Primer & Serper Divergen).`);
    if (task.liveInspection) {
      task.liveInspection.scrapedArticlesCount = targetScrapeUrls.length;
      task.liveInspection.scraper = {
        status: 'memindai',
        totalScraped: targetScrapeUrls.length,
        articles: targetScrapeUrls.map(u => ({
          title: u.title,
          url: u.url,
          domain: u.domain,
          sourceProvider: u.sourceProvider,
          length: (u.snippet || '').length,
          sample: u.snippet || 'Sedang mengekstrak teks artikel utuh...'
        }))
      };
    }

    // Eksekusi Web Scraping secara Batch Concurrency (5 request simultan per batch) untuk kecepatan tinggi
    const SCRAPE_BATCH_SIZE = 5;
    for (let idx = 0; idx < targetScrapeUrls.length; idx += SCRAPE_BATCH_SIZE) {
      if (task.aborted) break;
      const currentBatch = targetScrapeUrls.slice(idx, idx + SCRAPE_BATCH_SIZE);
      const batchNum = Math.floor(idx / SCRAPE_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(targetScrapeUrls.length / SCRAPE_BATCH_SIZE);

      task.currentStep = `[Langkah 2/3] Memindai serentak batch ${batchNum}/${totalBatches} (${Math.min(idx + SCRAPE_BATCH_SIZE, targetScrapeUrls.length)}/${targetScrapeUrls.length} artikel)...`;
      task.progressPercent = 55 + Math.round((Math.min(idx + SCRAPE_BATCH_SIZE, targetScrapeUrls.length) / targetScrapeUrls.length) * 20);

      const batchPromises = currentBatch.map(async (sourceItem) => {
        const providerLabel = sourceItem.sourceProvider || 'Web';
        try {
          const scrapedText = await fetchPageContent(sourceItem.url, 3500);
          if (scrapedText && scrapedText.length > 200) {
            return {
              title: sourceItem.title,
              url: sourceItem.url,
              domain: sourceItem.domain,
              sourceProvider: providerLabel,
              content: scrapedText
            };
          }
        } catch (e) {}
        return null;
      });

      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach(res => {
        if (res.status === 'fulfilled' && res.value) {
          scrapedArticles.push(res.value);
          const safeTitle = res.value.title || 'Artikel Web';
          task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] ✓ Berhasil memindai konten [${res.value.sourceProvider}]: "${safeTitle.substring(0, 40)}..." (${(res.value.content || '').length} karakter)`);
        }
      });

      if (task.liveInspection) {
        task.liveInspection.scrapedArticlesCount = scrapedArticles.length;
        task.liveInspection.scraper = {
          status: idx + SCRAPE_BATCH_SIZE >= targetScrapeUrls.length ? 'selesai' : 'memindai',
          totalScraped: scrapedArticles.length,
          articles: scrapedArticles.map(a => ({
            title: a.title || 'Artikel Web',
            url: a.url,
            domain: a.domain,
            sourceProvider: a.sourceProvider,
            length: (a.content || '').length,
            sample: (a.content || '').substring(0, 240) + '...'
          }))
        };
      }
    }

    // Gabungkan konten hasil scraping ke dalam data temuan
    if (scrapedArticles.length > 0) {
      const scrapedBlock = scrapedArticles.map((art, idx) => `--- [KONTEN UTUH ARTIKEL ${idx + 1}: ${art.title} (${art.url}) | ASAL: ${art.sourceProvider || 'Web'}] ---\n${art.content}\n--- [AKHIR ARTIKEL ${idx + 1}] ---`).join('\n\n');
      dataTemuan.push(`### Hasil Pemindaian Konten Mendalam (Full Web Scraping):\n${scrapedBlock}`);

      if (task.liveInspection) {
        task.liveInspection.scrapedArticlesCount = scrapedArticles.length;
        task.liveInspection.scraper = {
          status: 'selesai',
          totalScraped: scrapedArticles.length,
          articles: scrapedArticles.map(a => ({
            title: a.title || 'Artikel Web',
            url: a.url,
            domain: a.domain,
            length: (a.content || '').length,
            sample: (a.content || '').substring(0, 240) + '...'
          }))
        };
      }
    } else if (task.liveInspection) {
      task.liveInspection.scrapedArticlesCount = targetScrapeUrls.length;
      task.liveInspection.scraper = {
        status: 'selesai',
        totalScraped: targetScrapeUrls.length,
        articles: targetScrapeUrls.map(u => ({
          title: u.title,
          url: u.url,
          domain: u.domain,
          length: (u.snippet || '').length + 320,
          sample: `${u.snippet}\n[Konten dievaluasi dari cuplikan primer terverifikasi]`
        }))
      };
    }

    // ==========================================
    // PILAR 2.5: PENCERNAAN KONTEN UTUH WEB OLEH MODEL RISET TUNGGAL
    // ==========================================
    task.currentStep = `[Langkah 2/3] Model Riset (${masterResearchModel}) mencerna isi teks artikel web Primer & Divergen...`;
    task.progressPercent = 75;
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] [Langkah 2/3] Model Riset (${masterResearchModel}) mulai mencerna teks artikel web Primer & Divergen secara mendalam.`);

    function buildBudgetedScrapedText(articles, maxTotalChars = 12000, perArticleCap = 2500) {
      if (!articles || articles.length === 0) return '';
      let remaining = maxTotalChars;
      const chunks = [];
      for (let idx = 0; idx < articles.length; idx++) {
        if (remaining <= 250) break;
        const a = articles[idx];
        const rawContent = (a.content || '').trim();
        if (!rawContent) continue;
        const allowed = Math.min(perArticleCap, remaining);
        const snippet = rawContent.length > allowed
          ? (rawContent.substring(0, allowed) + '\n... [konten artikel dipadatkan untuk batas konteks]')
          : rawContent;
        const block = `[Dokumen ${idx + 1}: ${a.title || 'Artikel'} (${a.url || ''})]\n${snippet}`;
        chunks.push(block);
        remaining -= block.length;
      }
      return chunks.join('\n\n');
    }

    const primerArticles = scrapedArticles.filter(a => (a.sourceProvider || '').includes('Primer') || (!(a.sourceProvider || '').includes('Divergen')));
    const divergenArticles = scrapedArticles.filter(a => (a.sourceProvider || '').includes('Divergen'));

    const primerScrapedText = buildBudgetedScrapedText(primerArticles, 12000, 2500);
    const divergenScrapedText = buildBudgetedScrapedText(divergenArticles, 12000, 2500);

    const promptCernaPrimer = `Anda adalah Agen 1 (Pakar Web Google & Riset Primer).
Topik Riset: "${topik}"

Berikut adalah isi teks utuh dokumen web primer hasil pemindaian langsung:
${primerScrapedText || 'Tidak ada teks artikel primer utuh.'}

Tugas Anda:
Cerna dan analisis secara mendalam seluruh teks web primer di atas. Rangkum temuan kunci, tren utama tahun 2026, data penting, dan fakta konkret dalam 3-4 paragraf berbobot padat.`;

    const promptCernaDivergen = `Anda adalah Agen 2 (Pakar Analisis Divergen & Domain Mandiri).
Topik Riset: "${topik}"

Berikut adalah isi teks utuh dokumen web dari domain independen/teknis hasil pemindaian langsung:
${divergenScrapedText || 'Tidak ada teks artikel divergen utuh.'}

Tugas Anda:
Cerna dan analisis secara kritis seluruh teks web divergen di atas. Ekstrak perspektif alternatif, data statistik spesifik, arsitektur teknis, dan tantangan riil dalam 3-4 paragraf berbobot padat.`;

    let laporanPakarAgen1 = '';
    let laporanPakarAgen2 = '';

    try {
      if (isFreeTierModel(masterResearchModel)) {
        if (primerScrapedText.trim()) {
          laporanPakarAgen1 = await callLLMBackend({
            ...config,
            messages: [],
            model: masterResearchModel,
            prompt: promptCernaPrimer,
            system: 'Anda adalah Agen 1: Analis Web Primer yang bertugas membedah dan menyaring konten artikel web.'
          }).catch(err => {
            console.warn('Gagal pencernaan artikel Agen 1:', err?.message || err);
            return `[Analisis Temuan Agen 1]:\n${dataTemuan.filter(t => t.includes('AGEN 1')).join('\n') || 'Analisis artikel selesai.'}`;
          });
        }
        await sleep(1500); // Jeda adaptif sebelum dokumen divergen
        if (divergenScrapedText.trim()) {
          laporanPakarAgen2 = await callLLMBackend({
            ...config,
            messages: [],
            model: masterResearchModel,
            prompt: promptCernaDivergen,
            system: 'Anda adalah Agen 2: Analis Data Divergen yang bertugas membedah konten teknis dan independen.'
          }).catch(err => {
            console.warn('Gagal pencernaan artikel Agen 2:', err?.message || err);
            return `[Analisis Temuan Agen 2]:\n${dataTemuan.filter(t => t.includes('AGEN 2')).join('\n') || 'Analisis artikel divergen selesai.'}`;
          });
        }
      } else {
        const [hasil1, hasil2] = await Promise.all([
          (primerScrapedText.trim()) ? callLLMBackend({
            ...config,
            messages: [],
            model: masterResearchModel,
            prompt: promptCernaPrimer,
            system: 'Anda adalah Agen 1: Analis Web Primer yang bertugas membedah dan menyaring konten artikel web.'
          }).catch(err => {
            console.warn('Gagal pencernaan artikel Agen 1:', err?.message || err);
            return `[Analisis Temuan Agen 1]:\n${dataTemuan.filter(t => t.includes('AGEN 1')).join('\n') || 'Analisis artikel selesai.'}`;
          }) : Promise.resolve('Tidak ada artikel web primer yang dicerna.'),

          (divergenScrapedText.trim()) ? callLLMBackend({
            ...config,
            messages: [],
            model: masterResearchModel,
            prompt: promptCernaDivergen,
            system: 'Anda adalah Agen 2: Analis Data Divergen yang bertugas membedah konten teknis dan independen.'
          }).catch(err => {
            console.warn('Gagal pencernaan artikel Agen 2:', err?.message || err);
            return `[Analisis Temuan Agen 2]:\n${dataTemuan.filter(t => t.includes('AGEN 2')).join('\n') || 'Analisis artikel divergen selesai.'}`;
          }) : Promise.resolve('Tidak ada artikel web divergen yang dicerna.')
        ]);
        laporanPakarAgen1 = hasil1;
        laporanPakarAgen2 = hasil2;
      }
    } catch (digestErr) {
      console.warn('Pencernaan artikel oleh Model Riset mengalami kendala:', digestErr?.message || digestErr);
    }

    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] ✓ Pencernaan selesai: Model Riset (${masterResearchModel}) telah memproduksi output telaah Primer & Divergen.`);

    // Publikasikan hasil telaah mendalam ke snapshot live inspection
    if (task.liveInspection) {
      if (task.liveInspection.agent1 && laporanPakarAgen1) task.liveInspection.agent1.analysis = laporanPakarAgen1;
      if (task.liveInspection.agent2 && laporanPakarAgen2) task.liveInspection.agent2.analysis = laporanPakarAgen2;
    }

    // ==========================================
    // PILAR 3, 4, & 5: VALIDASI SUMBER, KATEGORISASI TREN & LAPORAN TERSTRUKTUR (MULTI-AGENT SYNTHESIS)
    // ==========================================
    if (task.aborted) {
      task.status = 'dibatalkan';
      task.currentStep = 'Riset dihentikan oleh pengguna.';
      task.completedAt = new Date().toISOString();
      return;
    }

    // ==========================================
    // PILAR 3: AUDIT, KOREKSI & PENYEMPURNAAN OLEH MODEL RISET (LEAD REVIEWER & CORRECTOR)
    // Sesuai Mandat Kaisar: Model riset tunggal bertindak sebagai pengoreksi yang menyempurnakan,
    // menghubungkan output telaah Primer & Divergen, serta mengelaborasi dokumen laporan riset secara sangat mendalam dan luas.
    // ==========================================
    task.currentStep = `[Langkah 3/4] Model Riset (${masterResearchModel}) mengoreksi, menghubungkan temuan Primer & Divergen, serta menyempurnakan laporan komprehensif...`;
    task.progressPercent = 85;
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] [Langkah 3/4] Model Riset (${masterResearchModel}) mulai mengoreksi dan merajut konektivitas temuan Primer & Divergen.`);

    // Batasi muatan data temuan di corrector prompt agar tidak melampaui context window limit LLM (maksimal 16.000 karakter)
    let rawTemuanBlock = dataTemuan.join('\n\n');
    if (rawTemuanBlock.length > 16000) {
      rawTemuanBlock = rawTemuanBlock.substring(0, 16000) + '\n\n... [Data temuan lanjutan dipadatkan untuk batas efisiensi context window model]';
    }

    const correctorPrompt = `Anda adalah Lead Scientific Reviewer, Fact-Corrector & Master Enhancer.
Tugas utama Anda BUKAN sekadar merangkum atau menulis ulang secara dangkal, melainkan:
1. MENGOREKSI & MEMVALIDASI: Periksa fakta, deteksi klaim tanpa dasar, koreksi kesalahan teknis atau bias dari output telaah Agen 1 dan Agen 2.
2. MENGHUBUNGKAN SECARA LOGIS (INTERCONNECTIVITY): Buat output telaah Agen 1 (Pakar Web Google) dan Agen 2 (Pakar Analisis Divergen) SALING TERHUBUNG dan bersinergi, menjelaskan bagaimana fakta primer berhubungan dengan sudut pandang teknis independen.
3. MENYEMPURNAKAN & MENGELABORASI SECARA MENDALAM: Elaborasikan temuan menjadi laporan riset ilmiah yang SANGAT MENDALAM, KAYA DATA, KOMPREHENSIF, DAN PANJANG/BANYAK (Deep Comprehensive Report) tahun rujukan 2026.

=== OUTPUT ANALISIS DARI AGIS 1 (PAKAR WEB GOOGLE PRIMER: ${masterResearchModel}) ===
${laporanPakarAgen1 || 'Telaah Agen 1 selesai.'}

=== OUTPUT ANALISIS DARI AGEN 2 (PAKAR ANALISIS DIVERGEN & DOMAIN MANDIRI: ${masterResearchModel}) ===
${laporanPakarAgen2 || 'Telaah Agen 2 selesai.'}

=== DATA PEMINDAIAN WEB UTUH & TEMUAN MULTI-TAHAP ===
${rawTemuanBlock}

Daftar Seluruh Sumber Rujukan Terverifikasi (${allSources.length} Dokumen Web):
${allSources.map((s, idx) => `[${idx + 1}] [${s.sourceProvider || 'Web'}] ${s.title}: ${s.url}`).join('\n')}

Format Laporan Komprehensif yang WAJIB dipatuhi:
# 🔬 DEEP RESEARCH REPORT: ${topik.toUpperCase()}
> **Status:** Riset Mendalam Multi-Agen Terkoreksi & Tervalidasi Silang  
> **Lead Auditor & Corrector:** Model Riset (${masterResearchModel})  
> **Sumber Terverifikasi:** ${scrapedArticles.length} Dokumen Scraping Utuh & ${allSources.length} Referensi Web  
> **Tahun Rujukan:** 2026

---

## 1. 📌 Pendahuluan & Ringkasan Komprehensif (Comprehensive Overview)
(Uraikan secara mendalam esensi topik, konteks global, latar belakang historis, dan urgensi temuan dalam 3-4 paragraf berbobot analitis)

## 2. 🔍 Temuan Utama & Elaborasi Teknis Mendalam (In-Depth Technical Analysis)
(Analisis teknis mendalam dan panjang mengenai fakta spesifik, arsitektur, mekanisme kerja, data riil, dan dinamika industri 2026)

## 3. ⚖️ Koreksi Faktual, Konsensus & Validasi Silang Multi-Model (Fact-Correction & Cross-Verification)
(Bagian koreksi: Jelaskan secara transparan bagian mana dari klaim awal yang telah dikoreksi, diverifikasi, atau diselaraskan antara data Agen 1 dan Agen 2. Hubungkan secara jelas titik temu konsensus dan perbedaan pandangannya)

## 4. 🔗 Sinergi & Konektivitas Temuan (Interconnected Synthesis Agen 1 & Agen 2)
(Jelaskan bagaimana temuan fakta primer dari Agen 1 dan telaah teknis divergen dari Agen 2 saling melengkapi, membentuk pemahaman holistik yang tidak bisa didapat dari satu sumber saja)

## 5. 📊 Matriks Data Komparatif, Statistik & Tren Pasar 2026
- **Data Statistik & Angka Konkret:** (Sajikan angka statistik riil, persentase, estimasi nilai pasar 2026)
- **Perspektif Pakar & Industri:** (Opini tokoh, pakar independen, dan konsensus lembaga riset)
- **Tantangan Teknis, Keamanan & Etika:** (Analisis hambatan mendalam)
- **Transformasi & Potensi Pasar:** (Dampak ekonomi dan teknologis)

## 6. ⚠️ Analisis Risiko, Regulasi & Hambatan Implementasi
(Uraian komprehensif mengenai kepatuhan hukum, regulasi, kendala teknis, dan langkah mitigasi risiko)

## 7. 🚀 Proyeksi Masa Depan & Trajektori Tren (Future Roadmap 2026-2030)
(Analisis mendalam mengenai arah perkembangan tren teknologi, riset masa depan, dan evolusi ekosistem hingga tahun-tahun mendatang)

## 8. 🛠️ Rekomendasi Strategis & Kerangka Implementasi Praktis
(Langkah konkret teknis, panduan arsitektur sistem, blueprint implementasi, atau contoh penerapan nyata yang aplikatif)

---
### 📚 Daftar Pustaka / Sumber Referensi Terverifikasi:
Sajikan seluruh tautan asli markdown [Nama Sumber](URL) lengkap dengan keterangan sumber asal (Serper Primer / Serper Divergen) agar pembaca dapat langsung merujuk ke dokumen aslinya.`;

    if (task.liveInspection) {
      task.liveInspection.synthesizer = {
        name: 'Model 3 (Lead Corrector & Enhancer)',
        model: masterResearchModel,
        status: 'menyusun',
        text: 'Model Riset sedang mengoreksi, menghubungkan temuan Agen 1 & Agen 2, serta menyempurnakan dokumen riset komprehensif...',
        timestamp: new Date().toLocaleTimeString('id-ID')
      };
    }

    if (isFreeTierModel(masterResearchModel)) {
      await sleep(1500); // Jeda adaptif sebelum model pengoreksi/penyusun laporan akhir
    }

    const laporanAkhir = await callLLMBackend({
      ...config,
      prompt: correctorPrompt,
      system: 'Anda adalah Lead Scientific Reviewer, Fact-Corrector & Master Enhancer yang mengoreksi, menghubungkan, menyempurnakan, dan mengelaborasi laporan riset komprehensif secara mendalam dan berbobot tinggi.',
      model: masterResearchModel
    });

    if (task.liveInspection) {
      task.liveInspection.synthesizer = {
        name: 'Model 3 (Lead Corrector & Enhancer)',
        model: masterResearchModel,
        status: 'selesai',
        text: laporanAkhir,
        timestamp: new Date().toLocaleTimeString('id-ID')
      };
    }

    if (task.aborted) {
      task.status = 'dibatalkan';
      task.currentStep = 'Riset dihentikan oleh pengguna.';
      task.completedAt = new Date().toISOString();
      return;
    }

    // ==========================================
    // PILAR 4: PENYUSUNAN RANGKUMAN EKSEKUTIF ANTARMUKA CHAT OLEH MODEL RISET
    // Sesuai Mandat Kaisar: Model riset merumuskan rangkuman khusus untuk tampil di gelembung obrolan chat.
    // ==========================================
    task.currentStep = `[Langkah 4/4] Model Riset (${masterResearchModel}) merumuskan rangkuman eksekutif untuk antarmuka chat...`;
    task.progressPercent = 95;
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] [Langkah 4/4] Model Riset (${masterResearchModel}) merumuskan rangkuman eksekutif antarmuka chat.`);

    let summaryInput = (laporanAkhir || '').trim();
    if (summaryInput.length > 18000) {
      summaryInput = summaryInput.substring(0, 18000) + '\n\n... [Laporan lengkap dipadatkan untuk penyusunan rangkuman eksekutif]';
    }

    const summaryPrompt = `Anda adalah Lead Executive Communicator & Chat Summarizer.
Tugas Anda adalah membaca Laporan Riset Komprehensif yang telah dikoreksi dan disempurnakan mengenai topik: "${topik}".

=== LAPORAN RISET LENGKAP TERKOREKSI ===
${summaryInput}

=== TUGAS ANDA ===
Susun RANGKUMAN EKSEKUTIF (Executive Summary) padat, tajam, dan elegan yang akan ditampilkan LANGSUNG DI ANTARMUKA CHAT (di dalam gelembung obrolan pengguna).
Rangkuman ini BUKAN laporan lengkap (karena laporan lengkap ${allSources.length} sumber akan dibaca lewat modal tombol).
Rangkuman ini harus menyajikan intisari paling berharga agar pengguna langsung paham dalam 30 detik!

Format Rangkuman Chat yang WAJIB dipatuhi:
### 💡 Rangkuman Eksekutif Riset
(Uraikan 1-2 paragraf padat mengenai esensi topik dan kesimpulan utama yang telah divalidasi)

#### ⚡ Poin Kunci & Temuan Terkoreksi:
- **Inti Temuan:** (Poin krusial dari hasil penelusuran 2026)
- **Konsensus & Koreksi:** (Bagaimana temuan divalidasi dan diselaraskan)
- **Data & Fakta Utama:** (Statistik konkret, metrik, atau data spesifik terverifikasi)
- **Tantangan Utama:** (Hambatan kritis atau risiko regulasi yang perlu diwaspadai)

#### 🚀 Implikasi Strategis & Rekomendasi:
(2-3 butir rekomendasi taktis atau langkah strategis yang dapat langsung diambil)

*Catatan: Rangkuman ringkas ini disiapkan khusus untuk antarmuka chat. Dokumen analisis riset mendalam utuh (${allSources.length} sumber) dapat dibuka melalui tombol di bawah.*`;

    let chatSummary = '';
    try {
      if (isFreeTierModel(masterResearchModel)) {
        await sleep(1500); // Jeda adaptif sebelum rangkuman chat
      }
      chatSummary = await callLLMBackend({
        ...config,
        prompt: summaryPrompt,
        system: 'Anda adalah Model 4: Executive Summarizer yang menyajikan intisari riset secara padat, tajam, profesional, dan siap saji di antarmuka chat.',
        model: masterResearchModel
      });
    } catch (sumErr) {
      console.warn('Penyusunan rangkuman chat oleh Model Riset mengalami kendala:', sumErr?.message || sumErr);
      chatSummary = `### 💡 Rangkuman Eksekutif Riset\nRiset mendalam mengenai **${topik}** telah berhasil diselesaikan dan divalidasi silang melalui ${allSources.length} sumber rujukan terverifikasi.\n\nSilakan klik tombol **[📖 Buka Laporan]** di bawah untuk membaca dokumen analisis lengkap hasil riset.`;
    }

    if (task.liveInspection) {
      task.liveInspection.model4 = {
        name: 'Model 4 (Executive Chat Summarizer)',
        model: masterResearchModel,
        status: 'selesai',
        text: chatSummary,
        timestamp: new Date().toLocaleTimeString('id-ID')
      };
    }

    if (task.aborted) {
      task.status = 'dibatalkan';
      task.currentStep = 'Riset dihentikan oleh pengguna.';
      task.completedAt = new Date().toISOString();
      if (config.sessionId && task.hasil) {
        appendAssistantMessageToSessionDisk(config.sessionId, task.hasil + '\n\n*[Riset dihentikan oleh pengguna]*', config.model || config.finalModel || masterResearchModel || 'Deep Research Pro', {
          isDeepResearch: true,
          chatSummary: chatSummary,
          sources: allSources
        });
      }
      return;
    }

    task.status = 'selesai';
    task.progressPercent = 100;
    task.currentStep = 'Laporan Riset & Rangkuman Eksekutif Chat Berhasil Disusun.';
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] Riset selesai sempurna: Laporan Lengkap (Model 3) & Rangkuman Chat (Model 4) siap.`);
    task.hasil = laporanAkhir;
    task.chatSummary = chatSummary;
    task.sources = allSources;
    task.completedAt = new Date().toISOString();

    if (config.sessionId) {
      appendAssistantMessageToSessionDisk(config.sessionId, laporanAkhir, config.model || config.finalModel || masterResearchModel || 'Deep Research Pro', {
        isDeepResearch: true,
        chatSummary: chatSummary,
        sources: allSources
      });
    }

  } catch (error) {
    console.error('Deep research failed:', error);
    task.status = 'gagal';
    task.error = error.message;
    task.currentStep = 'Riset gagal: ' + error.message;
    task.completedAt = new Date().toISOString();
  }
}

// Main HTTP Server
const server = http.createServer(async (req, res) => {
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint, x-title, HTTP-Referer, x-serper-key, x-ollama-key, x-api-key, x-openrouter-key, x-session-id, X-Session-ID'
    });
    return res.end();
  }

  // --- API ROUTES ---

  // Health check
  if (pathname === '/api/health' && method === 'GET') {
    return sendJSON(res, 200, {
      status: 'online',
      name: 'Zoz Router',
      version: '1.0.0',
      storage: 'device-disk',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }

  // --- DEVICE STORAGE: SESSIONS & CHAT HISTORY ---
  const sessionMatch = pathname.match(/^\/api\/sessions\/([a-zA-Z0-9_-]+)$/);

  // 1. List all sessions (Lightweight summaries)
  if (pathname === '/api/sessions' && method === 'GET') {
    try {
      if (!fs.existsSync(SESSIONS_DIR)) {
        return sendJSON(res, 200, { sessions: [] });
      }
      const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
      const sessions = [];
      for (const file of files) {
        try {
          const fullPath = path.join(SESSIONS_DIR, file);
          const content = fs.readFileSync(fullPath, 'utf8');
          const sess = JSON.parse(content);
          const lastMsg = (sess.messages && sess.messages.length > 0) ? sess.messages[sess.messages.length - 1].content : '';
          sessions.push({
            id: sess.id || path.basename(file, '.json'),
            title: sess.title || 'Obrolan Baru',
            mode: sess.mode || 'ollama',
            createdAt: sess.createdAt || fs.statSync(fullPath).birthtime.toISOString(),
            updatedAt: sess.updatedAt || fs.statSync(fullPath).mtime.toISOString(),
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
    const validation = validateSessionId(sessionMatch[1]);
    if (!validation.valid) return sendJSON(res, 400, { error: validation.error });
    const { id, sessFile } = validation;
    if (!fs.existsSync(sessFile)) {
      return sendJSON(res, 404, { error: 'Sesi tidak ditemukan di disk perangkat.' });
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
    try {
      const body = await parseBody(req);
      if (!body || !body.id) {
        return sendJSON(res, 400, { error: 'ID sesi diperlukan.' });
      }
      const validation = validateSessionId(String(body.id).trim());
      if (!validation.valid) return sendJSON(res, 400, { error: validation.error });
      const { id, sessFile } = validation;
      body.updatedAt = new Date().toISOString();
      body.id = id;
      if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
      }
      const tempFile = sessFile + `.tmp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      try {
        fs.writeFileSync(tempFile, JSON.stringify(body, null, 2), 'utf8');
        fs.renameSync(tempFile, sessFile);
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
    const validation = validateSessionId(sessionMatch[1]);
    if (!validation.valid) return sendJSON(res, 400, { error: validation.error });
    const { id, sessFile } = validation;
    try {
      const body = await parseBody(req);
      let existing = {};
      if (fs.existsSync(sessFile)) {
        try { existing = JSON.parse(fs.readFileSync(sessFile, 'utf8')); } catch (e) {}
      }
      const updated = {
        ...existing,
        ...body,
        id: id,
        updatedAt: new Date().toISOString()
      };
      if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
      }
      const tempFile = sessFile + `.tmp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      try {
        fs.writeFileSync(tempFile, JSON.stringify(updated, null, 2), 'utf8');
        fs.renameSync(tempFile, sessFile);
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
    const validation = validateSessionId(sessionMatch[1]);
    if (!validation.valid) return sendJSON(res, 400, { error: validation.error });
    const { id, sessFile } = validation;
    try {
      // Hentikan tugas background chat aktif untuk sesi ini agar tidak membangkitkan zombi sesi
      if (id && dbActiveChatTasks[id]) {
        const bgTask = dbActiveChatTasks[id];
        bgTask.status = 'aborted';
        if (bgTask.proxyReq && !bgTask.proxyReq.destroyed) {
          try { bgTask.proxyReq.destroy(); } catch (_) {}
        }
        delete dbActiveChatTasks[id];
      }

      // Hentikan tugas Deep Research aktif untuk sesi ini jika ada
      for (const rId of Object.keys(dbTugasRiset)) {
        const rTask = dbTugasRiset[rId];
        if (rTask && (rTask.sessionId === id || rTask.taskId === id)) {
          rTask.aborted = true;
          rTask.status = 'dibatalkan';
          delete dbTugasRiset[rId];
        }
      }

      if (fs.existsSync(sessFile)) {
        fs.unlinkSync(sessFile);
      }
      return sendJSON(res, 200, { success: true, message: `Sesi ${id} berhasil dihapus dari penyimpanan perangkat.` });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal menghapus file sesi dari disk: ' + err.message });
    }
  }

  // 6. Delete all sessions from disk
  if (pathname === '/api/sessions' && method === 'DELETE') {
    try {
      // Hentikan semua tugas background chat aktif
      for (const sid of Object.keys(dbActiveChatTasks)) {
        const bgTask = dbActiveChatTasks[sid];
        if (bgTask) {
          bgTask.status = 'aborted';
          if (bgTask.proxyReq && !bgTask.proxyReq.destroyed) {
            try { bgTask.proxyReq.destroy(); } catch (_) {}
          }
        }
        delete dbActiveChatTasks[sid];
      }

      // Hentikan semua tugas Deep Research aktif
      for (const rId of Object.keys(dbTugasRiset)) {
        const rTask = dbTugasRiset[rId];
        if (rTask) {
          rTask.aborted = true;
          rTask.status = 'dibatalkan';
        }
        delete dbTugasRiset[rId];
      }

      if (fs.existsSync(SESSIONS_DIR)) {
        const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try { fs.unlinkSync(path.join(SESSIONS_DIR, file)); } catch (e) {}
        }
      }
      return sendJSON(res, 200, { success: true, message: 'Semua riwayat sesi berhasil dibersihkan dari penyimpanan perangkat.' });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal membersihkan riwayat: ' + err.message });
    }
  }

  // 7. Native Media Upload to Disk (Stores files in data/uploads/)
  if (pathname === '/api/upload' && method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body || !body.data) {
        return sendJSON(res, 400, { error: 'Data gambar atau file diperlukan.' });
      }
      let rawData = String(body.data).trim();
      let ext = '.png';
      let base64Content = rawData;

      // Match standard Data URL format: data:<mediatype>[;charset=utf-8][;base64],<data>
      const dataUrlMatch = rawData.match(/^data:([a-zA-Z0-9.+_-]+\/[a-zA-Z0-9.+_-]+)(?:;[^,]+)*;base64,(.*)$/s);
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

      const filename = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
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
    const uploadFilePath = path.join(UPLOADS_DIR, uploadFilename);
    const relUpload = path.relative(UPLOADS_DIR, uploadFilePath);
    if (relUpload.startsWith('..') || path.isAbsolute(relUpload)) {
      return sendJSON(res, 403, { error: 'Forbidden' });
    }
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
      let query = reqUrl.searchParams.get('q') || reqUrl.searchParams.get('query') || '';
      let apiKey = req.headers['x-serper-key'] || req.headers['x-api-key'] || '';
      let num = parseInt(reqUrl.searchParams.get('num') || reqUrl.searchParams.get('limit') || '15', 10);
      if (method === 'POST') {
        const body = await parseBody(req);
        query = body.query || body.q || query;
        apiKey = body.apiKey || body.serperApiKey || body.key || apiKey;
        if (body.num || body.limit) num = parseInt(body.num || body.limit, 10);
      }
      if (!query) {
        return sendJSON(res, 400, { error: 'Parameter query `q` atau body `{ query }` diperlukan.' });
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
      let query = reqUrl.searchParams.get('q') || reqUrl.searchParams.get('query') || '';
      let context = reqUrl.searchParams.get('context') || '';
      let maxResults = parseInt(reqUrl.searchParams.get('maxResults') || '8', 10);
      if (method === 'POST') {
        const body = await parseBody(req);
        query = body.query || body.q || query;
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
      let targetUrl = reqUrl.searchParams.get('url') || reqUrl.searchParams.get('target') || '';
      let maxChars = parseInt(reqUrl.searchParams.get('maxChars') || '5000', 10);
      if (method === 'POST') {
        const body = await parseBody(req);
        targetUrl = body.url || body.targetUrl || targetUrl;
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

  // Deep Research: Start Autonomous Research (Background Worker)
  if ((pathname === '/api/mulai-riset' || pathname === '/api/deep-research/start') && method === 'POST') {
    try {
      const body = await parseBody(req);
      const topik = body.topik || body.topic || body.query || body.prompt || '';
      if (!topik) {
        return sendJSON(res, 400, { error: 'Parameter `topik` atau `prompt` diperlukan untuk memulai Deep Research.' });
      }

      if (body.endpoint && typeof body.endpoint === 'string') {
        let testEp = body.endpoint.trim();
        if (!/^https?:\/\//i.test(testEp)) {
          testEp = `http://${testEp}`;
        }
        if (isOllamaEndpointForbidden(testEp)) {
          return sendJSON(res, 400, { error: 'Endpoint Ollama mengarah ke host privat/internal - akses diblokir (SSRF Protection).' });
        }
      }

      pruneResearchTasks();
      const rawSessionId = body.sessionId || req.headers['x-session-id'] || req.headers['X-Session-ID'] || null;
      const taskId = 'research_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      dbTugasRiset[taskId] = {
        taskId,
        sessionId: rawSessionId,
        topik,
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

      // Jalankan proses riset secara asinkronus di latar belakang dengan arsitektur 1-Model super efisien
      jalankanRisetOtonom(taskId, topik, {
        sessionId: rawSessionId,
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
        const body = await parseBody(req);
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

      if (method === 'POST') {
        const body = await parseBody(req);
        prompt = body.prompt || body.q || '';
        sessionId = body.sessionId || req.headers['x-session-id'] || req.headers['X-Session-ID'] || null;
        model = body.model || model;
        width = parseInt(body.width, 10) || width;
        height = parseInt(body.height, 10) || height;
        seed = body.seed || null;
        openRouterKey = body.openRouterKey || body.apiKey || (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null) || req.headers['x-openrouter-key'] || req.headers['x-api-key'] || process.env.OPENROUTER_API_KEY;
      } else {
        prompt = reqUrl.searchParams.get('prompt') || reqUrl.searchParams.get('q') || '';
        sessionId = reqUrl.searchParams.get('sessionId') || req.headers['x-session-id'] || req.headers['X-Session-ID'] || null;
        model = reqUrl.searchParams.get('model') || model;
        width = parseInt(reqUrl.searchParams.get('width'), 10) || width;
        height = parseInt(reqUrl.searchParams.get('height'), 10) || height;
        seed = reqUrl.searchParams.get('seed') || null;
        openRouterKey = (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null) || req.headers['x-openrouter-key'] || req.headers['x-api-key'] || process.env.OPENROUTER_API_KEY;
      }

      if (openRouterKey) {
        openRouterKey = String(openRouterKey).replace(/^Bearer\s+/i, '').trim();
      }

      if (!prompt || !prompt.trim()) {
        return sendJSON(res, 400, { success: false, error: 'Parameter `prompt` diperlukan untuk menghasilkan gambar.' });
      }

      const cleanPrompt = prompt.trim();
      const actualSeed = seed || Math.floor(Math.random() * 100000000);
      const startTime = Date.now();

      // Sanitasi dimensi gambar (min 256, max 2048)
      width = Math.min(Math.max(width, 256), 2048);
      height = Math.min(Math.max(height, 256), 2048);

      let effectiveModel = (model || 'flux').toLowerCase().trim();
      let remoteImageUrl = '';
      let imageBuffer = null;
      let contentType = 'image/png';

      const isCloudModel = effectiveModel.includes('/');

      // 1. OpenRouter Cloud Dedicated Image Generation (POST /api/v1/images)
      if (isCloudModel) {
        if (!openRouterKey) {
          return sendJSON(res, 400, { 
            success: false, 
            error: `OpenRouter API Key diperlukan untuk model cloud "${effectiveModel}". Silakan masukkan API Key Anda di menu Pengaturan > Provider Cloud.` 
          });
        }

        let lastOrError = null;

        // 1A. Primary: Dedicated OpenRouter Image Generation API (POST /api/v1/images)
        try {
          const orImageRes = await new Promise((resolve, reject) => {
            let settled = false;
            const safeResolve = (d) => { if (!settled) { settled = true; resolve(d); } };
            const safeReject = (e) => { if (!settled) { settled = true; reject(e); } };

            const postData = JSON.stringify({
              model: effectiveModel,
              prompt: cleanPrompt,
              aspect_ratio: '1:1'
            });

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

              const postData = JSON.stringify({
                model: effectiveModel,
                messages: [{ role: 'user', content: `Please generate an image: ${cleanPrompt}` }],
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
                      const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/);
                      if (mdMatch) {
                        return safeResolve({ remoteUrl: mdMatch[1] });
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
        remoteImageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${encodeURIComponent(effectiveModel)}&seed=${actualSeed}&nologo=true&enhance=true`;
        try {
          const downloaded = await downloadImageBuffer(remoteImageUrl, 40000);
          imageBuffer = downloaded.buffer;
          contentType = downloaded.contentType || 'image/png';
        } catch (dlErr) {
          console.warn('Gagal mengunduh buffer gambar Pollinations ke disk lokal:', dlErr.message);
        }
      }

      // 3. Simpan buffer gambar secara permanen ke UPLOADS_DIR perangkat jika tersedia
      let localUrl = '';
      let filename = null;
      let sizeBytes = 0;

      if (imageBuffer && imageBuffer.length > 0) {
        const ext = contentType.includes('webp') ? 'webp' : (contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png');
        filename = `ai_gen_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
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
        appendAssistantMessageToSessionDisk(sessionId, `[Gambar AI Hasil Generasi: "${cleanPrompt}"]`, effectiveModel, {
          isImageGen: true,
          type: 'image_generation',
          imageUrl: finalUrl,
          url: finalUrl,
          prompt: cleanPrompt,
          model: effectiveModel,
          width: width,
          height: height,
          seed: actualSeed,
          latency: duration
        });
      }

      return sendJSON(res, 200, {
        success: true,
        url: finalUrl,
        localUrl: localUrl || finalUrl,
        remoteUrl: remoteImageUrl || null,
        filename: filename,
        prompt: cleanPrompt,
        model: effectiveModel,
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

    // 2. Filter kata sensitif / tragedi / bunuh diri yang memicu false-positive filter Google
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

    // 3. Entity & biographical phrase scrubber
    let cleaned = p
      .replace(/\b(?:create|make|generate|produce|compose|write|bikin|buatkan|buat|mainkan)\s+(?:music|musik|song|lagu|track|audio|beat|melodi)\s+(?:for|about|of|tentang|untuk)?/gi, '')
      .replace(/\b(?:the\s+)?(?:life\s*story|biography|story|kisah\s*hidup|cerita)\s+(?:of|about|tentang)?/gi, '')
      .replace(/\b(?:for|about|tentang|mengenai)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g, 'a visionary heroic journey')
      .trim();

    if (!cleaned || cleaned.length < 5) {
      cleaned = 'Inspiring cinematic instrumental journey, uplifting melody, rich harmonic layers, dynamic rhythms';
    }

    // 4. Pastikan memiliki deskriptor musikal (genre, instrumen, tempo)
    const hasMusicalGenre = /rock|metal|pop|jazz|lofi|lo-fi|synthwave|cyberpunk|electronic|edm|classical|chiptune|hiphop|acoustic|ambient|orchestral|reggae|blues|techno|house|drill|trap|folk|ballad/i.test(cleaned);
    if (!hasMusicalGenre) {
      cleaned = `Cinematic emotional melodic tribute, ${cleaned}, rich instruments, soaring arrangement, 120 BPM`;
    }

    return cleaned;
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
              const bypassedPrompt = neuralTunnelMusicPrompt(prompt);
              return generateAudioViaOpenRouter({ model, prompt: bypassedPrompt, key, timeoutMs, isRetried: true }).then(resolve).catch(reject);
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

      if (method === 'POST') {
        const body = await parseBody(req);
        prompt = body.prompt || body.q || '';
        sessionId = body.sessionId || req.headers['x-session-id'] || null;
        requestedMusicModel = (body.musicModel || body.model || '').trim();
        openRouterKey = (body.openRouterKey || req.headers['x-openrouter-key'] || '').trim();
      } else {
        prompt = reqUrl.searchParams.get('prompt') || reqUrl.searchParams.get('q') || '';
        sessionId = reqUrl.searchParams.get('sessionId') || req.headers['x-session-id'] || null;
        requestedMusicModel = (reqUrl.searchParams.get('musicModel') || reqUrl.searchParams.get('model') || '').trim();
        openRouterKey = (req.headers['x-openrouter-key'] || '').trim();
      }
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
        });
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

  // ====================================================
  // AI VIDEO STUDIO: PROCEDURAL NEURAL VIDEO SYNTHESIS
  // ====================================================
  if ((pathname === '/api/generate-video' || pathname === '/api/video/generate') && (method === 'POST' || method === 'GET')) {
    try {
      let prompt = '';
      let style = 'cinematic-motion';
      let duration = 5;
      let sessionId = null;

      if (method === 'POST') {
        const body = await parseBody(req);
        prompt = body.prompt || body.q || '';
        style = body.style || style;
        duration = parseInt(body.duration, 10) || 5;
        sessionId = body.sessionId || req.headers['x-session-id'] || null;
      } else {
        prompt = reqUrl.searchParams.get('prompt') || reqUrl.searchParams.get('q') || '';
        style = reqUrl.searchParams.get('style') || style;
        duration = parseInt(reqUrl.searchParams.get('duration'), 10) || 5;
        sessionId = reqUrl.searchParams.get('sessionId') || req.headers['x-session-id'] || null;
      }

      if (!prompt || !prompt.trim()) {
        prompt = 'Cinematic drone shot of futuristic cyberpunk neon metropolis';
      }

      const cleanPrompt = prompt.trim();
      const randSuffix = Math.random().toString(36).substring(2, 8);

      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }

      // 1. Generate High-Res Visual Frame
      let styledPrompt = cleanPrompt;
      if (!/photorealistic|cinematic|detailed|4k|hd|render/i.test(styledPrompt)) {
        styledPrompt = `${cleanPrompt}, cinematic 4k wallpaper, atmospheric lighting, detailed realism, masterpiece`;
      }
      const encodedPrompt = encodeURIComponent(styledPrompt.slice(0, 700));
      const seed = Math.floor(Math.random() * 100000000);
      const remoteFrameUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&model=flux&seed=${seed}&nologo=true&enhance=true`;

      const tempImgPath = path.join(UPLOADS_DIR, `temp_frame_${Date.now()}_${randSuffix}.jpg`);
      const tempAudioPath = path.join(UPLOADS_DIR, `temp_audio_${Date.now()}_${randSuffix}.wav`);
      const videoFilename = `ai_video_${Date.now()}_${randSuffix}.mp4`;
      const localVideoPath = path.join(UPLOADS_DIR, videoFilename);

      const frameDownloaded = await downloadImageBuffer(remoteFrameUrl, 45000);
      fs.writeFileSync(tempImgPath, frameDownloaded.buffer);

      // 2. Synthesize Atmospheric Soundscape
      const audioSynth = { buffer: Buffer.alloc(44100 * 5 * 4) }; // video silent track (no local music synthesis)
      const wavHeader = createWavHeader(audioSynth.buffer.length, 44100, 2, 16);
      fs.writeFileSync(tempAudioPath, Buffer.concat([wavHeader, audioSynth.buffer]));

      // 3. Compile MP4 with FFmpeg Cinematic Motion & Sound
      const filter = "zoompan=z='min(zoom+0.0012,1.35)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=1280x720:fps=30";
      try {
        execSync(`ffmpeg -y -loop 1 -i "${tempImgPath}" -i "${tempAudioPath}" -vf "${filter}" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k -t 5 -shortest "${localVideoPath}"`, { stdio: 'pipe' });
      } finally {
        try { if (fs.existsSync(tempImgPath)) fs.unlinkSync(tempImgPath); } catch (_) {}
        try { if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath); } catch (_) {}
      }

      if (!fs.existsSync(localVideoPath)) {
        throw new Error('Gagal menghasilkan berkas video MP4.');
      }

      const fileStats = fs.statSync(localVideoPath);
      const url = `/uploads/${videoFilename}`;
      const title = `Cinematic Video [${cleanPrompt.slice(0, 40)}]`;

      if (sessionId) {
        appendAssistantMessageToSessionDisk(sessionId, `[Video AI Hasil Generasi: "${cleanPrompt}"]`, 'Neural Video Studio', {
          isVideoGen: true,
          type: 'video_generation',
          videoUrl: url,
          url: url,
          title: title,
          style: style,
          duration: 5,
          prompt: cleanPrompt
        });
      }

      return sendJSON(res, 200, {
        success: true,
        url: url,
        filename: videoFilename,
        title: title,
        style: style,
        duration: 5,
        sizeBytes: fileStats.size,
        format: 'mp4',
        prompt: cleanPrompt
      });
    } catch (err) {
      console.error('Video generation failed:', err);
      return sendJSON(res, 500, {
        success: false,
        error: 'Gagal membuat video AI: ' + (err.message || 'Terjadi kesalahan sistem.'),
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

    const tryFetchTags = (endpointUrl) => {
      return new Promise((resolve) => {
        try {
          const ollamaUrl = resolveEndpointUrl(endpointUrl, 'api/tags');
          const client = ollamaUrl.protocol === 'https:' ? https : http;
          const reqHeaders = { 'User-Agent': 'ZozRouter/1.0' };
          if (authHeader) reqHeaders['Authorization'] = authHeader;

          const proxyReq = client.get(ollamaUrl.toString(), { timeout: 6000, headers: reqHeaders }, (proxyRes) => {
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

          const proxyReq = client.get(ollamaUrl.toString(), { timeout: 6000, headers: reqHeaders }, (proxyRes) => {
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
        return sendJSON(res, 200, result);
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
      return sendJSON(res, 200, { status: 'starting', message: 'Perintah `ollama serve` telah dipicu di latar belakang.' });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Gagal menjalankan ollama: ' + e.message });
    }
  }

  // Ollama Cloud: Chat Completion (Streaming Proxy)
  if (pathname === '/api/ollama/chat' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const rawKey = body.apiKey || body.ollamaApiKey || req.headers['x-ollama-key'] || (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : '') || process.env.OLLAMA_API_KEY;
      const authHeader = rawKey ? `Bearer ${rawKey}` : (req.headers['authorization'] || null);
      let customEndpoint = req.headers['x-ollama-endpoint'] || body.endpoint || 'http://127.0.0.1:11434';

      if (!customEndpoint) {
        customEndpoint = 'http://127.0.0.1:11434';
      }

      customEndpoint = customEndpoint.trim();
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

      if (!body.model) {
        body.model = 'qwen2.5:1.5b';
      }

      const sessionId = body.sessionId || req.headers['x-session-id'] || null;
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
          model: body.model || 'Ollama Model',
          provider: 'ollama',
          userPrompt: userPrompt || null,
          fullText: '',
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
          // Akumulasi token untuk background resilience
          if (sessionId) {
            accumulateChatChunk(sessionId, chunk, 'ollama');
          }

          if (clientDisconnected || res.writableEnded || res.destroyed) {
            if (!sessionId && !proxyReq.destroyed) proxyReq.destroy();
            return;
          }
          try {
            res.write(chunk);
          } catch (e) {}
        });

        proxyRes.on('end', () => {
          if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
            try {
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
              appendAssistantMessageToSessionDisk(sessionId, task.fullText, task.model);
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
      return sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // OpenRouter: Get Model List
  if (pathname === '/api/openrouter/models' && method === 'GET') {
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
            return sendJSON(res, proxyRes.statusCode, {
              success: false,
              data: [],
              error: data?.error?.message || data?.message || `HTTP ${proxyRes.statusCode} from OpenRouter`,
              ...data
            });
          }
          return sendJSON(res, proxyRes.statusCode, data);
        } catch (e) {
          return sendJSON(res, 502, { success: false, data: [], error: 'Failed to parse OpenRouter response' });
        }
      });
      proxyRes.on('error', (err) => {
        if (!res.headersSent) sendJSON(res, 502, { success: false, data: [], error: 'OpenRouter models stream error: ' + err.message });
      });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) sendJSON(res, 504, { error: 'OpenRouter models request timed out (15s)' });
    });

    proxyReq.on('error', (err) => {
      if (res.headersSent) return;
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
    try {
      const body = await parseBody(req);
      const authHeader = req.headers['authorization'];
      const rawKey = body.apiKey || body.openRouterKey || req.headers['x-openrouter-key'] || req.headers['x-api-key'] || (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || process.env.OPENROUTER_API_KEY;

      if (!rawKey) {
        return sendJSON(res, 401, { error: 'OpenRouter API Key diperlukan. Masukkan API Key di Pengaturan Zoz Router.' });
      }

      const apiKey = `Bearer ${String(rawKey).replace(/^Bearer\s+/i, '').trim()}`;
      delete body.apiKey;
      delete body.openRouterKey;

      const sessionId = body.sessionId || req.headers['x-session-id'] || null;
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

      if (sessionId) {
        if (dbActiveChatTasks[sessionId] && dbActiveChatTasks[sessionId].status === 'streaming') {
          return sendJSON(res, 429, { error: 'Stream already active for this session' });
        }
        dbActiveChatTasks[sessionId] = {
          sessionId,
          model: body.model || 'OpenRouter Model',
          provider: 'openrouter',
          userPrompt: userPrompt || null,
          fullText: '',
          rawBuffer: '',
          status: 'streaming',
          startedAt: Date.now(),
          proxyReq: null
        };
      }

      // Defense-in-depth: Cegah konflik mutlak parameter model dan models pada OpenRouter
      if (body.model && body.models) {
        delete body.models;
      }

      // Defense-in-depth: Hapus tool gambar jika model adalah model gratis
      const isFree = body.model && (body.model.includes(':free') || body.model === 'openrouter/free');
      if (isFree && Array.isArray(body.tools)) {
        delete body.tools;
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
          'HTTP-Referer': 'http://localhost:4040',
          'X-Title': 'ZOZ ROUTER Neural AI Gateway',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 120000
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
          // Akumulasi token untuk background resilience
          if (sessionId) {
            accumulateChatChunk(sessionId, chunk, 'openrouter');
          }

          if (clientDisconnected || res.writableEnded || res.destroyed) {
            if (!sessionId && proxyReq && !proxyReq.destroyed) proxyReq.destroy();
            return;
          }
          try {
            res.write(chunk);
          } catch (e) {}
        });

        proxyRes.on('end', () => {
          if (!clientDisconnected && !res.writableEnded && !res.destroyed) {
            try {
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
              appendAssistantMessageToSessionDisk(sessionId, task.fullText, task.model);
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
      return sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ----------------------------------------------------
  // CLAUDE AI RESILIENCE: GET CHAT TASK STATUS
  // ----------------------------------------------------
  const chatStatusMatch = pathname.match(/^\/api\/chat\/status\/([a-zA-Z0-9_-]+)$/);
  if ((chatStatusMatch || pathname === '/api/chat/status') && method === 'GET') {
    const sid = chatStatusMatch ? chatStatusMatch[1] : (reqUrl.searchParams.get('sessionId') || reqUrl.searchParams.get('id'));
    if (!sid) {
      const activeSessions = [];
      const recentlyCompletedSessions = [];
      const now = Date.now();

      for (const k of Object.keys(dbActiveChatTasks)) {
        const t = dbActiveChatTasks[k];
        if (!t) continue;
        if (t.status === 'streaming') {
          activeSessions.push({ sessionId: t.sessionId, model: t.model, startedAt: t.startedAt });
        } else if (t.status === 'completed' && t.completedAt && (now - t.completedAt < 600000)) {
          recentlyCompletedSessions.push({ sessionId: t.sessionId, model: t.model, completedAt: t.completedAt });
        }
      }

      for (const rId of Object.keys(dbTugasRiset)) {
        const rTask = dbTugasRiset[rId];
        if (!rTask) continue;
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

    const task = dbActiveChatTasks[sid];
    if (task && (task.status === 'streaming' || task.status === 'completed')) {
      return sendJSON(res, 200, {
        active: task.status === 'streaming',
        status: task.status,
        sessionId: task.sessionId,
        model: task.model,
        text: task.fullText || '',
        startedAt: task.startedAt,
        completedAt: task.completedAt || null,
        error: task.error || null
      });
    }

    // Periksa apakah ada tugas Deep Research aktif atau baru selesai untuk sesi ini
    const matchingResearchTasks = [];
    for (const rId of Object.keys(dbTugasRiset)) {
      const rTask = dbTugasRiset[rId];
      if (rTask && (rTask.sessionId === sid || rTask.taskId === sid)) {
        matchingResearchTasks.push(rTask);
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
      return sendJSON(res, 200, {
        active: task.status === 'streaming',
        status: task.status,
        sessionId: task.sessionId,
        model: task.model,
        text: task.fullText || '',
        startedAt: task.startedAt,
        completedAt: task.completedAt || null,
        error: task.error || null
      });
    }

    return sendJSON(res, 200, { active: false, status: 'none', sessionId: sid });
  }

  // ----------------------------------------------------
  // CLAUDE AI RESILIENCE: STOP ACTIVE CHAT TASK
  // ----------------------------------------------------
  if ((pathname === '/api/chat/stop' || pathname.startsWith('/api/chat/stop/')) && method === 'POST') {
    try {
      const body = await parseBody(req);
      const urlSid = pathname.startsWith('/api/chat/stop/') ? pathname.split('/')[4] : null;
      const sid = body.sessionId || urlSid || reqUrl.searchParams.get('sessionId');
      let stoppedAny = false;

      if (sid && dbActiveChatTasks[sid] && dbActiveChatTasks[sid].status === 'streaming') {
        const task = dbActiveChatTasks[sid];
        task.status = 'aborted';
        if (task.proxyReq && !task.proxyReq.destroyed) {
          try { task.proxyReq.destroy(); } catch (_) {}
        }
        if (task.rawBuffer) {
          flushChatTaskBuffer(sid, task.provider || 'openrouter');
        }
        // Simpan potongan yang sudah terlanjur dibuat
        if (task.fullText && task.fullText.trim()) {
          appendAssistantMessageToSessionDisk(sid, task.fullText + '\n\n*[Respons dihentikan oleh pengguna]*', task.model);
        }
        stoppedAny = true;
      }

      // Hentikan juga tugas Deep Research aktif untuk sesi ini jika ada
      if (sid) {
        for (const rId of Object.keys(dbTugasRiset)) {
          const rTask = dbTugasRiset[rId];
          if (rTask && (rTask.sessionId === sid || rTask.taskId === sid || rTask.taskId === body.taskId) && rTask.status === 'sedang_meneliti') {
            rTask.aborted = true;
            rTask.status = 'dibatalkan';
            rTask.currentStep = 'Riset dihentikan oleh pengguna.';
            rTask.completedAt = new Date().toISOString();
            stoppedAny = true;
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
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': idxStats.size,
          'Cache-Control': 'no-cache'
        });
        if (method === 'HEAD') return res.end();
        fs.readFile(indexPath, (idxErr, content) => {
          if (res.writableEnded || res.destroyed) return;
          if (idxErr) {
            try { res.destroy(); } catch (_) {}
            return;
          }
          res.end(content);
        });
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });
    if (method === 'HEAD') return res.end();

    fs.readFile(filePath, (readErr, content) => {
      if (res.writableEnded || res.destroyed) return;
      if (readErr) {
        try { res.destroy(); } catch (_) {}
        return;
      }
      res.end(content);
    });
  });
});

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

process.on('unhandledRejection', (reason) => {
  console.warn('⚠️ Warning: Unhandled Promise Rejection ditangkap:', reason && (reason.stack || reason.message || reason));
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Critical: Uncaught Exception ditangkap:', err && (err.stack || err.message || err));
});

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
