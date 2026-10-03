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
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
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
function performWebSearch(query, apiKey = null) {
  return new Promise((resolve) => {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return resolve({ query: '', count: 0, results: [] });
    }
    const cleanQuery = query.trim();
    const serperKey = apiKey || process.env.SERPER_API_KEY || '075538fed9c64990e1eb32a06726c1e55a933c1e';

    const postData = JSON.stringify({
      q: cleanQuery,
      num: 6,
      gl: 'id',
      hl: 'id'
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
          const results = [];
          
          if (parsed.knowledgeGraph) {
            results.push({
              title: parsed.knowledgeGraph.title || 'Knowledge Graph Fact',
              url: parsed.knowledgeGraph.website || parsed.knowledgeGraph.descriptionUrl || 'https://google.com',
              snippet: `${parsed.knowledgeGraph.type ? '[' + parsed.knowledgeGraph.type + '] ' : ''}${parsed.knowledgeGraph.description || ''}`,
              type: 'knowledgeGraph'
            });
          }

          if (parsed.answerBox) {
            results.push({
              title: parsed.answerBox.title || 'Jawaban Teratas',
              url: parsed.answerBox.link || 'https://google.com',
              snippet: parsed.answerBox.answer || parsed.answerBox.snippet || '',
              type: 'answerBox'
            });
          }

          if (Array.isArray(parsed.organic)) {
            parsed.organic.slice(0, 6).forEach((item, idx) => {
              results.push({
                title: item.title || `Hasil ${idx + 1}`,
                url: item.link || '',
                snippet: item.snippet || '',
                date: item.date || null,
                domain: item.link ? (new URL(item.link)).hostname.replace(/^www\./, '') : ''
              });
            });
          }

          resolve({
            query: cleanQuery,
            count: results.length,
            knowledgeGraph: parsed.knowledgeGraph || null,
            answerBox: parsed.answerBox || null,
            organic: parsed.organic || [],
            results: results
          });
        } catch (e) {
          resolve({ query: cleanQuery, count: 0, results: [], error: e.message });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ query: cleanQuery, count: 0, results: [], error: 'Serper search timed out' });
    });

    req.on('error', (err) => {
      resolve({ query: cleanQuery, count: 0, results: [], error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

// Main HTTP Server
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost:4040'}`);
  const pathname = reqUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint, x-title, HTTP-Referer, x-serper-key, x-ollama-key'
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
    const sessionId = sessionMatch[1];
    const sessFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
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
        return sendJSON(res, 400, { error: 'ID sesi diperlukan' });
      }
      const sessionId = body.id;
      const sessFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
      body.updatedAt = new Date().toISOString();
      fs.writeFileSync(sessFile, JSON.stringify(body, null, 2), 'utf8');
      return sendJSON(res, 200, { success: true, session: body });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal menyimpan sesi ke disk perangkat: ' + err.message });
    }
  }

  // 4. Update session (Rename / Edit title / Merge update)
  if (sessionMatch && (method === 'PUT' || method === 'PATCH')) {
    const sessionId = sessionMatch[1];
    const sessFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
    try {
      const body = await parseBody(req);
      let existing = {};
      if (fs.existsSync(sessFile)) {
        try { existing = JSON.parse(fs.readFileSync(sessFile, 'utf8')); } catch (e) {}
      }
      const updated = {
        ...existing,
        ...body,
        id: sessionId,
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(sessFile, JSON.stringify(updated, null, 2), 'utf8');
      return sendJSON(res, 200, { success: true, session: updated });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal memperbarui sesi di disk: ' + err.message });
    }
  }

  // 5. Delete specific session file from disk
  if (sessionMatch && method === 'DELETE') {
    const sessionId = sessionMatch[1];
    const sessFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
    try {
      if (fs.existsSync(sessFile)) {
        fs.unlinkSync(sessFile);
      }
      return sendJSON(res, 200, { success: true, message: `Sesi ${sessionId} berhasil dihapus dari penyimpanan perangkat.` });
    } catch (err) {
      return sendJSON(res, 500, { error: 'Gagal menghapus file sesi dari disk: ' + err.message });
    }
  }

  // 6. Delete all sessions from disk
  if (pathname === '/api/sessions' && method === 'DELETE') {
    try {
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
      let base64Data = body.data;
      let ext = '.png';
      const match = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
      if (match) {
        ext = '.' + (match[1] === 'jpeg' ? 'jpg' : match[1]);
        base64Data = base64Data.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
      }
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
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
    const uploadFilename = path.basename(pathname);
    const uploadFilePath = path.join(UPLOADS_DIR, uploadFilename);
    if (fs.existsSync(uploadFilePath) && fs.statSync(uploadFilePath).isFile()) {
      const ext = path.extname(uploadFilePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(uploadFilePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': content.length,
        'Cache-Control': 'public, max-age=86400'
      });
      return res.end(content);
    }
  }

// Web Search API Endpoint (Serper Google Search Engine)
  if (pathname === '/api/web-search' && (method === 'GET' || method === 'POST')) {
    try {
      let query = reqUrl.searchParams.get('q') || reqUrl.searchParams.get('query') || '';
      let apiKey = req.headers['x-serper-key'] || reqUrl.searchParams.get('apiKey') || '';
      if (method === 'POST') {
        const body = await parseBody(req);
        query = body.query || body.q || query;
        apiKey = body.apiKey || body.serperApiKey || apiKey;
      }
      if (!query) {
        return sendJSON(res, 400, { error: 'Parameter query `q` atau body `{ query }` diperlukan.' });
      }
      const data = await performWebSearch(query, apiKey);
      return sendJSON(res, 200, data);
    } catch (e) {
      return sendJSON(res, 500, { error: 'Gagal melakukan pencarian web Serper: ' + e.message });
    }
  }

// Ollama: Check status & get models (with multi-route fallback & disk manifests)
  if (pathname === '/api/ollama/models' && method === 'GET') {
    let rawEndpoint = reqUrl.searchParams.get('endpoint') || req.headers['x-ollama-endpoint'] || 'http://127.0.0.1:11434';
    const authHeader = req.headers['authorization'] || (req.headers['x-ollama-key'] ? `Bearer ${req.headers['x-ollama-key']}` : null);

    // If API key is provided and endpoint is default local or empty, route to official Ollama Cloud (https://ollama.com)
    if (authHeader && (rawEndpoint.includes('127.0.0.1') || rawEndpoint.includes('localhost') || !rawEndpoint)) {
      rawEndpoint = 'https://ollama.com';
    }

    rawEndpoint = rawEndpoint.trim();
    if (!/^https?:\/\//i.test(rawEndpoint)) {
      rawEndpoint = (rawEndpoint.includes(':443') || rawEndpoint.includes('ollama.com') || rawEndpoint.includes('.com') || rawEndpoint.includes('.io') || rawEndpoint.includes('.ai') || rawEndpoint.includes('.app')) 
        ? `https://${rawEndpoint}` 
        : `http://${rawEndpoint}`;
    }
    rawEndpoint = rawEndpoint.replace(/\/+$/, '');

    const tryFetchTags = (endpointUrl) => {
      return new Promise((resolve) => {
        try {
          const ollamaUrl = new URL('/api/tags', endpointUrl);
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
          const ollamaUrl = new URL('/v1/models', endpointUrl);
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

      // If remote returned empty or failed, check disk manifests for local
      const diskModels = getLocalOllamaManifests();
      if (diskModels.length > 0) {
        return sendJSON(res, 200, { models: diskModels, server_running: true, note: 'Loaded from local manifests' });
      }

      return sendJSON(res, 200, { models: [], server_running: false, warning: 'Ollama service offline / unreachable' });
    })();
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
      child.unref();
      return sendJSON(res, 200, { status: 'starting', message: 'Perintah `ollama serve` telah dipicu di latar belakang.' });
    } catch (e) {
      return sendJSON(res, 500, { error: 'Gagal menjalankan ollama: ' + e.message });
    }
  }

  // Ollama: Chat Completion (Streaming Proxy)
  if (pathname === '/api/ollama/chat' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const authHeader = req.headers['authorization'] || (body.apiKey ? `Bearer ${body.apiKey}` : (req.headers['x-ollama-key'] ? `Bearer ${req.headers['x-ollama-key']}` : null));
      let customEndpoint = req.headers['x-ollama-endpoint'] || body.endpoint || 'http://127.0.0.1:11434';

      if (authHeader && (customEndpoint.includes('127.0.0.1') || customEndpoint.includes('localhost') || !customEndpoint)) {
        customEndpoint = 'https://ollama.com';
      }

      customEndpoint = customEndpoint.trim();
      if (!/^https?:\/\//i.test(customEndpoint)) {
        customEndpoint = (customEndpoint.includes(':443') || customEndpoint.includes('ollama.com') || customEndpoint.includes('.com') || customEndpoint.includes('.io') || customEndpoint.includes('.ai') || customEndpoint.includes('.app')) 
          ? `https://${customEndpoint}` 
          : `http://${customEndpoint}`;
      }
      customEndpoint = customEndpoint.replace(/\/+$/, '');

      delete body.endpoint; // Don't send custom field to Ollama
      delete body.apiKey;

      const ollamaUrl = new URL('/api/chat', customEndpoint);
      const client = ollamaUrl.protocol === 'https:' ? https : http;

      const postData = JSON.stringify(body);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const proxyHeaders = {
        'Content-Type': 'application/json',
        'User-Agent': 'ZozRouter/1.0',
        'Content-Length': Buffer.byteLength(postData)
      };
      if (authHeader) {
        proxyHeaders['Authorization'] = authHeader;
      }

      const proxyReq = client.request(ollamaUrl.toString(), {
        method: 'POST',
        headers: proxyHeaders
      }, (proxyRes) => {
        proxyRes.on('data', chunk => {
          res.write(chunk);
        });

        proxyRes.on('end', () => {
          res.end();
        });
      });

      proxyReq.on('error', (err) => {
        res.write(JSON.stringify({ error: `Ollama Stream Error: ${err.message}` }) + '\n');
        res.end();
      });

      req.on('close', () => {
        proxyReq.destroy();
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
    const authHeader = req.headers['authorization'];
    const options = {
      hostname: 'openrouter.ai',
      port: 443,
      path: '/api/v1/models',
      method: 'GET',
      headers: {
        'User-Agent': 'ZozRouter/1.0',
        ...(authHeader ? { 'Authorization': authHeader } : {})
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let rawData = '';
      proxyRes.on('data', chunk => rawData += chunk);
      proxyRes.on('end', () => {
        try {
          const data = JSON.parse(rawData);
          return sendJSON(res, proxyRes.statusCode, data);
        } catch (e) {
          return sendJSON(res, 502, { error: 'Failed to parse OpenRouter response' });
        }
      });
    });

    proxyReq.on('error', (err) => {
      return sendJSON(res, 503, { error: 'OpenRouter connection error: ' + err.message });
    });

    proxyReq.end();
    return;
  }

  // OpenRouter: Validate API Key / Check Auth Status
  if (pathname === '/api/openrouter/auth-check' && method === 'GET') {
    const authHeader = req.headers['authorization'];
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
      }
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
    });

    proxyReq.on('error', (err) => {
      return sendJSON(res, 503, { error: 'Auth check failed: ' + err.message });
    });

    proxyReq.end();
    return;
  }

  // OpenRouter: Chat Completion (Streaming Proxy)
  if (pathname === '/api/openrouter/chat' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const authHeader = req.headers['authorization'];

      if (!authHeader && !body.apiKey) {
        return sendJSON(res, 401, { error: 'OpenRouter API Key diperlukan. Masukkan API Key di Pengaturan Zoz Router.' });
      }

      const apiKey = authHeader || `Bearer ${body.apiKey}`;
      delete body.apiKey;

      const postData = JSON.stringify(body);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

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
        }
      };

      const proxyReq = https.request(options, (proxyRes) => {
        if (proxyRes.statusCode !== 200) {
          let errData = '';
          proxyRes.on('data', chunk => errData += chunk);
          proxyRes.on('end', () => {
            res.write(`data: ${JSON.stringify({ error: `OpenRouter Error [${proxyRes.statusCode}]: ${errData}` })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          });
          return;
        }

        proxyRes.on('data', chunk => {
          res.write(chunk);
        });

        proxyRes.on('end', () => {
          res.end();
        });
      });

      proxyReq.on('error', (err) => {
        res.write(`data: ${JSON.stringify({ error: `OpenRouter Network Error: ${err.message}` })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      });

      req.on('close', () => {
        proxyReq.destroy();
      });

      proxyReq.write(postData);
      proxyReq.end();
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // --- STATIC FILE SERVING ---
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, safePath);

  // Security check: prevent path traversal outside public
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJSON(res, 403, { error: 'Forbidden' });
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback for SPA routing to index.html if file doesn't exist
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (idxErr, content) => {
        if (idxErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        return sendJSON(res, 500, { error: 'File read error' });
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': content.length,
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    });
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
    console.log(`⚔️ Dual Arena Mode: Active`);
    console.log(`======================================================\n`);
  });
}

module.exports = server;
