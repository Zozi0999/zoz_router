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

// Helper to send JSON responses
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint'
  });
  res.end(JSON.stringify(data));
}

// Helper to parse JSON request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 50 * 1024 * 1024) { // 50MB limit (for image inputs)
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON: ' + err.message));
      }
    });
    req.on('error', reject);
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint, x-title, HTTP-Referer'
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
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
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
          // Path pattern: registry.ollama.ai/library/<modelName>/<tag>
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

// Helper to perform quick web search via DuckDuckGo HTML scraping (zero dependencies)
function performWebSearch(query) {
  return new Promise((resolve) => {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return resolve({ query: '', results: [] });
    }
    const cleanQuery = query.trim();
    const encoded = encodeURIComponent(cleanQuery);
    const postData = `q=${encoded}&b=`;

    const options = {
      hostname: 'html.duckduckgo.com',
      port: 443,
      path: '/html/',
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
      },
      timeout: 8000
    };

    const req = https.request(options, (res) => {
      let rawHtml = '';
      res.on('data', chunk => rawHtml += chunk);
      res.on('end', () => {
        try {
          const results = [];
          // Match result blocks
          const linkRegex = /<a[^>]+class="result__snippet[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
          const titleRegex = /<a[^>]+class="result__url"[^>]*>([\s\S]*?)<\/a>/gi;
          const headingRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

          let match;
          const cleanText = (str) => {
            if (!str) return '';
            return str
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&nbsp;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          };

          // Find all heading matches
          const headings = [];
          while ((match = headingRegex.exec(rawHtml)) !== null && headings.length < 8) {
            let url = match[1];
            // Decode DDG uddg redirect if present
            const uddgMatch = url.match(/uddg=([^&]+)/);
            if (uddgMatch) {
              try { url = decodeURIComponent(uddgMatch[1]); } catch(e){}
            }
            headings.push({ url, title: cleanText(match[2]) });
          }

          // Find all snippet matches
          const snippets = [];
          while ((match = linkRegex.exec(rawHtml)) !== null && snippets.length < 8) {
            snippets.push(cleanText(match[2]));
          }

          for (let i = 0; i < headings.length; i++) {
            results.push({
              title: headings[i].title || `Hasil ${i+1}`,
              url: headings[i].url,
              snippet: snippets[i] || 'Tidak ada deskripsi tersedia.'
            });
          }

          resolve({ query: cleanQuery, count: results.length, results });
        } catch (e) {
          resolve({ query: cleanQuery, count: 0, results: [], error: e.message });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ query: cleanQuery, count: 0, results: [], error: 'Web search timed out' });
    });

    req.on('error', (err) => {
      resolve({ query: cleanQuery, count: 0, results: [], error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

// Web Search API Endpoint
  if (pathname === '/api/web-search' && (method === 'GET' || method === 'POST')) {
    try {
      let query = reqUrl.searchParams.get('q') || reqUrl.searchParams.get('query') || '';
      if (!query && method === 'POST') {
        const body = await parseBody(req);
        query = body.query || body.q || '';
      }
      if (!query) {
        return sendJSON(res, 400, { error: 'Parameter query `q` atau body `{ query }` diperlukan.' });
      }
      const data = await performWebSearch(query);
      return sendJSON(res, 200, data);
    } catch (e) {
      return sendJSON(res, 500, { error: 'Gagal melakukan pencarian web: ' + e.message });
    }
  }

// Ollama: Check status & get models (with disk manifest fallback)
  if (pathname === '/api/ollama/models' && method === 'GET') {
    const customEndpoint = reqUrl.searchParams.get('endpoint') || req.headers['x-ollama-endpoint'] || 'http://127.0.0.1:11434';
    const authHeader = req.headers['authorization'] || (req.headers['x-ollama-key'] ? `Bearer ${req.headers['x-ollama-key']}` : null);
    try {
      const ollamaUrl = new URL('/api/tags', customEndpoint);
      const client = ollamaUrl.protocol === 'https:' ? https : http;

      const reqHeaders = {};
      if (authHeader) reqHeaders['Authorization'] = authHeader;

      const proxyReq = client.get(ollamaUrl.toString(), { timeout: 3500, headers: reqHeaders }, (proxyRes) => {
        let rawData = '';
        proxyRes.on('data', chunk => rawData += chunk);
        proxyRes.on('end', () => {
          try {
            const data = JSON.parse(rawData);
            if (data.models && data.models.length > 0) {
              return sendJSON(res, proxyRes.statusCode, { ...data, server_running: true });
            }
            // If Ollama returns empty, merge with disk manifests
            const diskModels = getLocalOllamaManifests();
            return sendJSON(res, 200, { models: diskModels.length > 0 ? diskModels : (data.models || []), server_running: true });
          } catch (e) {
            const diskModels = getLocalOllamaManifests();
            return sendJSON(res, 200, { models: diskModels, server_running: true, warning: 'Parsed from local disk manifests' });
          }
        });
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        const diskModels = getLocalOllamaManifests();
        return sendJSON(res, 200, { 
          models: diskModels, 
          server_running: false, 
          warning: 'Ollama service timed out, models loaded from local manifest storage' 
        });
      });

      proxyReq.on('error', () => {
        const diskModels = getLocalOllamaManifests();
        return sendJSON(res, 200, { 
          models: diskModels, 
          server_running: false, 
          warning: 'Ollama service offline, models loaded from local manifest storage' 
        });
      });
    } catch (err) {
      const diskModels = getLocalOllamaManifests();
      return sendJSON(res, 200, { models: diskModels, server_running: false, error: err.message });
    }
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
      const customEndpoint = req.headers['x-ollama-endpoint'] || body.endpoint || 'http://127.0.0.1:11434';
      const authHeader = req.headers['authorization'] || (body.apiKey ? `Bearer ${body.apiKey}` : (req.headers['x-ollama-key'] ? `Bearer ${req.headers['x-ollama-key']}` : null));
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
