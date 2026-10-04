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
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.bin': 'application/octet-stream',
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

// Helper to send JSON responses
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint, x-title, HTTP-Referer, x-serper-key, x-ollama-key'
  });
  res.end(JSON.stringify(data));
}

// Helper to parse JSON request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // 50MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', err => reject(err));
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

          if (res.statusCode >= 400 || (parsed.message && !Array.isArray(parsed.organic))) {
            const errMsg = parsed.message || (parsed.error ? (typeof parsed.error === 'object' ? parsed.error.message : parsed.error) : `Serper HTTP ${res.statusCode} Error`);
            return resolve({ query: cleanQuery, count: 0, results: [], error: errMsg });
          }

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

// Helper untuk memanggil LLM (OpenRouter atau Ollama) dari backend dengan dukungan riwayat pesan
async function callLLMBackend({ prompt, system, messages, model, provider, endpoint, apiKey }) {
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

  if (provider === 'openrouter' || (apiKey && apiKey.startsWith('sk-or-'))) {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OpenRouter API Key diperlukan.');

    const postData = JSON.stringify({
      model: model || 'google/gemini-2.0-flash-001',
      messages: finalMessages,
      temperature: 0.3
    });

    return new Promise((resolve, reject) => {
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
              return reject(new Error(`OpenRouter Error [${res.statusCode}]: ${errMsg}`));
            }
            const content = parsed.choices?.[0]?.message?.content || '';
            if (!content.trim()) {
              return reject(new Error(`OpenRouter tidak mengembalikan konten respons untuk model: ${model || 'default'}`));
            }
            resolve(content);
          } catch (e) {
            reject(new Error('Gagal memproses respon OpenRouter: ' + e.message));
          }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('OpenRouter request timed out')); });
      req.on('error', err => reject(err));
      req.write(postData);
      req.end();
    });
  }

  // Fallback / Default: Ollama Engine
  const rawEp = endpoint || 'http://127.0.0.1:11434';
  const ollamaUrl = resolveEndpointUrl(rawEp, 'api/chat');
  const client = ollamaUrl.protocol === 'https:' ? https : http;

  const postData = JSON.stringify({
    model: model || 'nemotron-mini:latest',
    messages: finalMessages,
    stream: false,
    options: { temperature: 0.3 }
  });

  return new Promise((resolve, reject) => {
    const req = client.request(ollamaUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 90000
    }, (res) => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          if (res.statusCode >= 400 || parsed.error) {
            const errMsg = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : (parsed.error || `HTTP ${res.statusCode}: Permintaan Ollama gagal`);
            return reject(new Error(`Ollama Error [${res.statusCode}]: ${errMsg}`));
          }
          const content = parsed.message?.content || parsed.response || '';
          if (!content.trim()) {
            return reject(new Error(`Ollama tidak mengembalikan konten respons untuk model: ${model || 'default'}`));
          }
          resolve(content);
        } catch (e) {
          reject(new Error('Gagal memproses respon Ollama: ' + e.message));
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama request timed out')); });
    req.on('error', err => reject(err));
    req.write(postData);
    req.end();
  });
}

// Validasi host privat/lokal untuk proteksi SSRF
function isPrivateHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return true;
  const host = hostname.toLowerCase().trim();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true; // Link-local
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  return false;
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
      if (isPrivateHost(parsedUrl.hostname)) {
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
          'Accept-Language': 'id,en-US,en;q=0.9'
        },
        timeout: 6000
      };

      const req = client.request(options, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          try {
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            return fetchPageContent(redirectUrl, maxChars, redirectCount + 1).then(resolve);
          } catch (e) {
            return resolve('');
          }
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return resolve('');
        }

        let rawHtml = '';
        res.on('data', chunk => {
          rawHtml += chunk;
          if (rawHtml.length > 300000) req.destroy();
        });

        res.on('end', () => {
          try {
            let clean = rawHtml
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
              .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
              .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
              .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
              .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
              .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, ' ')
              .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
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
        });
      });

      req.on('timeout', () => { req.destroy(); resolve(''); });
      req.on('error', () => resolve(''));
      req.end();
    } catch (err) {
      resolve('');
    }
  });
}

// Fungsi Logika Agen: Meneliti Berulang Secara Otonom dengan 6 Pilar Deep Research Premium
async function jalankanRisetOtonom(taskId, topik, config = {}) {
  const task = dbTugasRiset[taskId];
  if (!task) return;

  const serperKey = config.serperApiKey || process.env.SERPER_API_KEY || '075538fed9c64990e1eb32a06726c1e55a933c1e';
  const maxIterations = config.maxIterations || 3;
  let allSources = [];
  let dataTemuan = [];
  let scrapedArticles = [];

  try {
    // ==========================================
    // PILAR 1 & 6: PENCARIAN MULTI-TAHAP & ASYNCHRONOUS QUEUE
    // ==========================================
    task.currentStep = '[Langkah 1/3] Menelusuri Google untuk topik dasar & pemetaan tren...';
    task.progressPercent = 15;
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] [Langkah 1/3] Menelusuri Google untuk topik dasar: "${topik}"`);

    let currentQuery = topik;

    for (let i = 1; i <= maxIterations; i++) {
      task.currentStep = `[Langkah 1/3] Iterasi ${i}/${maxIterations}: Menjelajah Google via Serper -> "${currentQuery}"`;
      task.progressPercent = 15 + Math.round((i / (maxIterations + 1)) * 30);
      task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] Iterasi ${i}: Pencarian Google -> "${currentQuery}"`);

      // A. Panggil Serper API untuk mencari di Google
      const searchRes = await performWebSearch(currentQuery, serperKey);
      
      if (searchRes.error) {
        task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] ⚠️ Peringatan Serper Search: "${searchRes.error}". Pastikan API Key Serper valid.`);
      }

      let findingsText = '';
      if (searchRes.knowledgeGraph) {
        findingsText += `\n[KNOWLEDGE GRAPH]: ${searchRes.knowledgeGraph.title || ''} - ${searchRes.knowledgeGraph.snippet || ''}\n`;
      }
      if (searchRes.answerBox) {
        findingsText += `\n[ANSWER BOX]: ${searchRes.answerBox.snippet || ''}\n`;
      }
      if (Array.isArray(searchRes.results)) {
        searchRes.results.forEach((item, idx) => {
          findingsText += `\n- ${item.title}: ${item.snippet} (${item.url})`;
          if (item.url && !allSources.some(s => s.url === item.url)) {
            allSources.push({
              title: item.title,
              url: item.url,
              snippet: item.snippet,
              domain: item.domain || (item.url ? (new URL(item.url)).hostname.replace(/^www\./, '') : '')
            });
          }
        });
      }

      dataTemuan.push(`### Temuan Iterasi ${i} (Query: "${currentQuery}"):\n${findingsText || 'Tidak ada hasil spesifik.'}`);

      if (i < maxIterations) {
        try {
          const evalPrompt = `Anda adalah AI Deep Research Planner.
Topik Utama: "${topik}"
Data Temuan Saat Ini:
${dataTemuan.join('\n\n')}

Tugas Evaluasi:
1. Analisis apakah informasi di atas sudah memadai untuk laporan mendalam komprehensif tahun 2026?
2. Jika sudah lengkap, jawab JSON: {"sudahCukup": true}
3. Jika belum, rumuskan kata kunci pencarian Google yang baru dan sangat spesifik (misal: aspek teknis, data statistik terbaru 2026, opini pakar, regulasi, studi kasus) dalam format JSON: {"sudahCukup": false, "kataKunciBaru": "query spesifik baru"}
Keluarkan hanya JSON valid tanpa teks tambahan.`;

          const evalResult = await callLLMBackend({
            prompt: evalPrompt,
            system: 'Anda adalah Research Evaluator otonom yang teliti dan analitis.',
            ...config
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
    const targetScrapeUrls = allSources.slice(0, 5);
    task.currentStep = `[Langkah 2/3] Menganalisis & memindai konten mendalam ${targetScrapeUrls.length} artikel web (Web Scraping)...`;
    task.progressPercent = 55;
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] [Langkah 2/3] Memulai web scraping ke ${targetScrapeUrls.length} tautan primer (membaca isi artikel utuh).`);

    for (let idx = 0; idx < targetScrapeUrls.length; idx++) {
      const sourceItem = targetScrapeUrls[idx];
      task.currentStep = `[Langkah 2/3] Membaca isi artikel (${idx + 1}/${targetScrapeUrls.length}): ${sourceItem.domain || sourceItem.title}...`;
      task.progressPercent = 55 + Math.round(((idx + 1) / targetScrapeUrls.length) * 20);

      const scrapedText = await fetchPageContent(sourceItem.url, 3500);
      if (scrapedText && scrapedText.length > 200) {
        scrapedArticles.push({
          title: sourceItem.title,
          url: sourceItem.url,
          domain: sourceItem.domain,
          content: scrapedText
        });
        task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] ✓ Berhasil memindai konten: "${sourceItem.title.substring(0, 45)}..." (${scrapedText.length} karakter)`);
      }
    }

    // Gabungkan konten hasil scraping ke dalam data temuan
    if (scrapedArticles.length > 0) {
      const scrapedBlock = scrapedArticles.map((art, idx) => `--- [KONTEN UTUH ARTIKEL ${idx + 1}: ${art.title} (${art.url})] ---\n${art.content}\n--- [AKHIR ARTIKEL ${idx + 1}] ---`).join('\n\n');
      dataTemuan.push(`### Hasil Pemindaian Konten Mendalam (Full Web Scraping):\n${scrapedBlock}`);
    }

    // ==========================================
    // PILAR 3, 4, & 5: VALIDASI SUMBER, KATEGORISASI TREN & LAPORAN TERSTRUKTUR
    // ==========================================
    task.currentStep = '[Langkah 3/3] Validasi silang fakta, penyaringan bias, kategorisasi tren, & menyusun laporan riset eksekutif...';
    task.progressPercent = 85;
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] [Langkah 3/3] Validasi silang data, filter kontradiksi & sintesis laporan profesional.`);

    const synthesisPrompt = `Anda adalah Lead Research Scientist, Senior Technical Analyst & Editor Ahli.
Susunlah LAPORAN DEEP RESEARCH KOMPREHENSIF untuk topik:
"${topik}"

Berikut adalah seluruh data temuan yang berhasil dikumpulkan melalui Pencarian Multi-Tahap dan Pemindaian Konten Mendalam (Web Scraping):
${dataTemuan.join('\n\n')}

Daftar Seluruh Sumber Terverifikasi (${allSources.length} Dokumen Web):
${allSources.map((s, idx) => `[${idx + 1}] ${s.title}: ${s.url}`).join('\n')}

Format Laporan yang WAJIB dipatuhi:
# 🔬 DEEP RESEARCH REPORT: ${topik.toUpperCase()}
> **Status:** Riset Mendalam Multi-Iterasi & Scraping Konten Selesai  
> **Sumber Terpindai:** ${scrapedArticles.length} Artikel Utuh & ${allSources.length} Dokumen Web  
> **Tahun Rujukan:** 2026

---

## 1. 📌 Pendahuluan & Ringkasan Eksekutif (Executive Summary)
(Uraikan ringkasan tingkat tinggi mengenai latar belakang, esensi topik, dan temuan inti dalam 2-3 paragraf berbobot tajam)

## 2. 🔍 Temuan Utama & Analisis Mendalam (Core Deep Findings)
(Analisis teknis, fakta-fakta spesifik dari hasil pembacaan artikel utuh, mekanisme kerja, dan data riil 2026)

## 3. ⚖️ Penyaringan Fakta & Validasi Sumber (Fact-Checking & Bias Analysis)
(Bandingkan fakta antar sumber: sebutkan poin konsensus, verifikasi klaim, dan catat bila ada kontradiksi/perbedaan pandangan antar pakar)

## 4. 📊 Matriks Data & Kategorisasi Tren (Trend & Synthesis Mapping)
- **Data & Fakta Statistik:** (Statistik konkret, angka, atau persentase)
- **Opini Tokoh & Pakar:** (Pandangan ahli di bidang terkait)
- **Tantangan & Hambatan:** (Regulasi, teknis, biaya, atau etika)
- **Peluang Industri & Dampak:** (Potensi nilai dan transformasi)

## 5. ⚠️ Tantangan & Hambatan Saat Ini
(Detail kendala implementasi, kepatuhan regulasi, atau keterbatasan saat ini)

## 6. 🚀 Tren & Analisis Masa Depan (Future Trajectory)
(Proyeksi perkembangan hingga akhir 2026 dan tahun-tahun berikutnya)

## 7. 🛠️ Rekomendasi Strategis & Implementasi Praktis
(Langkah konkret yang dapat diterapkan, arsitektur sistem, atau contoh kode/penerapan nyata jika relevan)

---
### 📚 Daftar Pustaka / Sumber Referensi:
Sajikan seluruh tautan asli markdown [Nama Sumber](URL) agar pengguna dapat langsung mengeklik rujukan aslinya.`;

    const laporanAkhir = await callLLMBackend({
      prompt: synthesisPrompt,
      system: 'Anda adalah Deep Research Engine yang menghasilkan laporan riset tingkat tinggi, sangat komprehensif, berbasis data nyata dari pemindaian artikel utuh, terstruktur rapi, dan bebas bias.',
      ...config
    });

    task.status = 'selesai';
    task.progressPercent = 100;
    task.currentStep = 'Laporan Deep Research Berhasil Disusun.';
    task.stepsHistory.push(`[${new Date().toLocaleTimeString('id-ID')}] Laporan Deep Research berhasil dibuat lengkap dengan sitasi & scraping konten.`);
    task.hasil = laporanAkhir;
    task.sources = allSources;
    task.completedAt = new Date().toISOString();

  } catch (error) {
    console.error('Deep research failed:', error);
    task.status = 'gagal';
    task.error = error.message;
    task.currentStep = 'Riset gagal: ' + error.message;
  }
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
    const relSess = path.relative(SESSIONS_DIR, sessFile);
    if (relSess.startsWith('..') || path.isAbsolute(relSess)) {
      return sendJSON(res, 403, { error: 'Forbidden: Path traversal terdeteksi.' });
    }
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
      const sessionId = String(body.id).trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
        return sendJSON(res, 400, { error: 'Format ID sesi tidak valid. Hanya alphanumeric, garis bawah, dan tanda hubung yang diperbolehkan.' });
      }
      const sessFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
      const relSess = path.relative(SESSIONS_DIR, sessFile);
      if (relSess.startsWith('..') || path.isAbsolute(relSess)) {
        return sendJSON(res, 403, { error: 'Forbidden: Path traversal terdeteksi.' });
      }
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
    const relSess = path.relative(SESSIONS_DIR, sessFile);
    if (relSess.startsWith('..') || path.isAbsolute(relSess)) {
      return sendJSON(res, 403, { error: 'Forbidden: Path traversal terdeteksi.' });
    }
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
    const relSess = path.relative(SESSIONS_DIR, sessFile);
    if (relSess.startsWith('..') || path.isAbsolute(relSess)) {
      return sendJSON(res, 403, { error: 'Forbidden: Path traversal terdeteksi.' });
    }
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
    const relUpload = path.relative(UPLOADS_DIR, uploadFilePath);
    if (relUpload.startsWith('..') || path.isAbsolute(relUpload)) {
      return sendJSON(res, 403, { error: 'Forbidden' });
    }
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

  // Deep Research: Start Autonomous Research (Background Worker)
  if ((pathname === '/api/mulai-riset' || pathname === '/api/deep-research/start') && method === 'POST') {
    try {
      const body = await parseBody(req);
      const topik = body.topik || body.topic || body.query || body.prompt || '';
      if (!topik) {
        return sendJSON(res, 400, { error: 'Parameter `topik` atau `prompt` diperlukan untuk memulai Deep Research.' });
      }

      pruneResearchTasks();
      const taskId = 'research_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      dbTugasRiset[taskId] = {
        taskId,
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

      // Jalankan proses riset secara asinkronus di latar belakang
      jalankanRisetOtonom(taskId, topik, {
        messages: body.messages || [],
        model: body.model,
        provider: body.provider,
        endpoint: body.endpoint,
        apiKey: body.apiKey || (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null),
        serperApiKey: body.serperApiKey || req.headers['x-serper-key'],
        maxIterations: body.maxIterations || 3
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
      sources: dataTugas.sources || [],
      error: dataTugas.error
    });
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

      const ollamaUrl = resolveEndpointUrl(customEndpoint, 'api/chat');
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
  const relative = path.relative(PUBLIC_DIR, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return sendJSON(res, 403, { error: 'Forbidden: Path traversal detected' });
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
