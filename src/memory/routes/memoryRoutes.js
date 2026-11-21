/**
 * Jozz Memory - HTTP API Router
 * Handles all /api/memories endpoints seamlessly with zero external router dependencies.
 */

const dbStorage = require('../storage/db');
const retriever = require('../pipeline/retriever');
const extractor = require('../pipeline/extractor');
const guardrails = require('../pipeline/guardrails');
const insights = require('../pipeline/insights');
const porter = require('../sovereignty/porter');

function sendJson(res, statusCode, data) {
  if (!res || res.headersSent || res.writableEnded || res.destroyed) return;
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  if (req && req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return Promise.resolve(req.body);
    }
    if (typeof req.body === 'string') {
      if (!req.body.trim()) return Promise.resolve({});
      try {
        return Promise.resolve(JSON.parse(req.body));
      } catch (e) {
        return Promise.reject(new Error(`Invalid JSON body: ${e.message}`));
      }
    }
    if (Buffer.isBuffer(req.body)) {
      const str = req.body.toString('utf8');
      if (!str.trim()) return Promise.resolve({});
      try {
        return Promise.resolve(JSON.parse(str));
      } catch (e) {
        return Promise.reject(new Error(`Invalid JSON body: ${e.message}`));
      }
    }
  }
  if (!req || req.readableEnded || req.complete) {
    return Promise.resolve({});
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;
    const doneResolve = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };
    const doneReject = (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };
    req.on('data', chunk => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > 5 * 1024 * 1024) { // 5MB limit
        doneReject(new Error('Payload JSON memori terlalu besar (maksimal 5MB).'));
        try { req.destroy(); } catch (_) {}
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      const bodyStr = chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : '';
      if (!bodyStr.trim()) return doneResolve({});
      try {
        doneResolve(JSON.parse(bodyStr));
      } catch (e) {
        doneReject(new Error(`Invalid JSON body: ${e.message}`));
      }
    });
    req.on('error', (err) => doneReject(err || new Error('Request stream error')));
    req.on('close', () => {
      if (!settled && req && req.complete === false) {
        return doneReject(new Error('Request aborted by client'));
      }
      doneResolve({});
    });
  });
}

function parseRawBody(req) {
  if (req && req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return Promise.resolve(req.body);
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString('utf8'));
    if (typeof req.body === 'object') {
      try { return Promise.resolve(JSON.stringify(req.body)); } catch (_) { return Promise.resolve(''); }
    }
  }
  if (!req || req.readableEnded || req.complete) {
    return Promise.resolve('');
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;
    const doneResolve = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };
    const doneReject = (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };
    req.on('data', chunk => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > 10 * 1024 * 1024) {
        doneReject(new Error('Payload memori terlalu besar (maksimal 10MB).'));
        try { req.destroy(); } catch (_) {}
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      doneResolve(chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : '');
    });
    req.on('error', (err) => doneReject(err || new Error('Request stream error')));
    req.on('close', () => {
      if (!settled && req && req.complete === false) {
        return doneReject(new Error('Request aborted by client'));
      }
      doneResolve('');
    });
  });
}

/**
 * Handle memory routes. Returns true if handled, false if path did not match.
 */
async function handleMemoryRoutes(req, res, reqUrl, validatedUserId = null) {
  const pathname = reqUrl.pathname;
  const method = req.method;

  if (!pathname.startsWith('/api/memories')) {
    return false;
  }

  const sanitizeUid = (raw) => {
    const clean = String(raw || '').trim();
    return (clean && clean !== '*') ? clean : 'default';
  };
  const hasValidatedUser = typeof validatedUserId === 'string' && validatedUserId.length > 0 && validatedUserId !== '*';
  const userId = hasValidatedUser
    ? validatedUserId
    : sanitizeUid(req.headers['x-user-id'] || reqUrl.searchParams.get('userId') || 'default');
  const getEffectiveUserId = (body) => hasValidatedUser
    ? userId
    : sanitizeUid((body && body.userId) || userId || 'default');

  try {
    // 1. GET /api/memories/insights
    if (method === 'GET' && pathname === '/api/memories/insights') {
      const scope = reqUrl.searchParams.get('scope') || null;
      const data = insights.generateMemoryInsights(userId, scope);
      sendJson(res, 200, { success: true, data, insights: data });
      return true;
    }

    // 2. GET /api/memories/receipts/:episodeId
    if (method === 'GET' && pathname.startsWith('/api/memories/receipts/')) {
      let episodeId = pathname.replace('/api/memories/receipts/', '').trim();
      try { episodeId = decodeURIComponent(episodeId); } catch (_) {}
      const episode = dbStorage.getEpisodeById(episodeId, userId);
      if (!episode) {
        sendJson(res, 404, { success: false, error: 'Episode receipt tidak ditemukan atau bukan milik akun Anda.' });
      } else {
        sendJson(res, 200, { success: true, episode });
      }
      return true;
    }

    // 3. GET /api/memories/export?format=json|md
    if (method === 'GET' && pathname === '/api/memories/export') {
      const format = (reqUrl.searchParams.get('format') || 'json').toLowerCase();
      const exported = porter.exportMemories(userId, format);
      res.writeHead(200, {
        'Content-Type': exported.contentType,
        'Content-Disposition': `attachment; filename="${exported.fileName}"`,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(exported.content);
      return true;
    }

    // 4. POST /api/memories/import
    if (method === 'POST' && pathname === '/api/memories/import') {
      const format = (reqUrl.searchParams.get('format') || 'json').toLowerCase();
      const rawContent = await parseRawBody(req);
      const result = porter.importMemories(userId, rawContent, format);
      sendJson(res, result.success ? 200 : 400, result);
      return true;
    }

    // 5. POST /api/memories/recall (Scoped Hybrid Recall for chat query)
    if (method === 'POST' && pathname === '/api/memories/recall') {
      const body = await parseJsonBody(req);
      const effectiveUserId = getEffectiveUserId(body);
      const query = body.query || body.message || '';
      const scope = body.scope || 'global';
      const incognito = Boolean(body.incognito);

      if (incognito) {
        sendJson(res, 200, {
          success: true,
          incognito: true,
          memories: [],
          receipts: [],
          systemPromptInjection: ''
        });
        return true;
      }

      const recallResult = retriever.recallMemories(effectiveUserId, query, scope, body.options || {});
      sendJson(res, 200, {
        success: true,
        incognito: false,
        ...recallResult
      });
      return true;
    }

    // 6. POST /api/memories/extract-background (Async worker trigger)
    if (method === 'POST' && pathname === '/api/memories/extract-background') {
      const body = await parseJsonBody(req);
      const effectiveUserId = getEffectiveUserId(body);
      const incognito = Boolean(body.incognito);
      if (!incognito) {
        extractor.triggerAsyncBackgroundExtraction({
          userId: effectiveUserId,
          sessionId: body.sessionId || 'default',
          sessionTitle: body.sessionTitle || '',
          turnIndex: body.turnIndex || 0,
          userMessage: body.userMessage || body.message || '',
          assistantResponse: body.assistantResponse || '',
          scope: body.scope || 'global',
          errorLesson: body.errorLesson || null,
          episodicSummary: body.episodicSummary || null,
          preferenceMemory: body.preferenceMemory || null
        });
      }
      sendJson(res, 200, { success: true, queued: !incognito });
      return true;
    }

    // 7. GET /api/memories (List with filters)
    if (method === 'GET' && (pathname === '/api/memories' || pathname === '/api/memories/')) {
      const category = reqUrl.searchParams.get('category') || null;
      const scope = reqUrl.searchParams.get('scope') || null;
      const q = reqUrl.searchParams.get('q') || null;
      const limit = reqUrl.searchParams.get('limit') || 50;

      const memories = dbStorage.listMemories(userId, { category, scope, q, limit });
      sendJson(res, 200, { success: true, count: memories.length, memories });
      return true;
    }

    // 8. POST /api/memories (Manual explicit memory creation)
    if (method === 'POST' && (pathname === '/api/memories' || pathname === '/api/memories/')) {
      const body = await parseJsonBody(req);
      const effectiveUserId = getEffectiveUserId(body);
      const content = body.content || body.fact || '';
      const scope = body.scope || 'global';

      if (!content || !content.trim()) {
        sendJson(res, 400, { success: false, error: 'Isi memori (content) wajib diisi.' });
        return true;
      }

      const resCapture = extractor.captureExplicitMemory(effectiveUserId, content, scope, {
        sessionId: body.sessionId || 'manual',
        sourceType: body.sourceType || 'manual',
        sourceTitle: body.sourceTitle || 'Input Manual Pengguna',
        category: body.category || null
      });

      sendJson(res, resCapture.success ? 201 : 400, resCapture);
      return true;
    }

    // 9. PATCH /api/memories/:id (Edit memory — scoped by userId + guardrails)
    if (method === 'PATCH' && pathname.startsWith('/api/memories/')) {
      let memoryId = pathname.replace('/api/memories/', '').trim();
      try { memoryId = decodeURIComponent(memoryId); } catch (_) {}
      if (!memoryId) {
        sendJson(res, 400, { success: false, error: 'ID memori wajib disertakan.' });
        return true;
      }
      const body = await parseJsonBody(req);
      const patchPayload = {};
      if (typeof body.content === 'string') {
        const sanitized = guardrails.sanitizeFactCandidate(body.content);
        if (!sanitized.accepted || !sanitized.content || !sanitized.content.trim()) {
          sendJson(res, 400, { success: false, error: sanitized.reason || 'Konten memori tidak valid atau kosong.' });
          return true;
        }
        patchPayload.content = sanitized.content;
      }
      if (typeof body.category === 'string' && body.category.trim()) {
        patchPayload.category = body.category.trim();
      }
      if (typeof body.scope === 'string' && body.scope.trim()) {
        patchPayload.scope = body.scope.trim();
      }
      if (typeof body.isActive !== 'undefined') {
        patchPayload.isActive = Boolean(body.isActive);
      }
      const updated = dbStorage.updateMemory(memoryId, patchPayload, userId);
      if (!updated) {
        sendJson(res, 404, { success: false, error: 'Memori tidak ditemukan atau bukan milik akun Anda.' });
      } else {
        sendJson(res, 200, { success: true, memory: updated });
      }
      return true;
    }

    // 10. DELETE /api/memories/:id or DELETE /api/memories (Clear All)
    if (method === 'DELETE') {
      if (pathname === '/api/memories' || pathname === '/api/memories/') {
        const confirmClear = reqUrl.searchParams.get('confirm') === 'true';
        if (!confirmClear) {
          sendJson(res, 400, { success: false, error: 'Harap sertakan parameter ?confirm=true untuk mengonfirmasi penghapusan seluruh memori.' });
          return true;
        }
        dbStorage.clearAllMemories(userId);
        sendJson(res, 200, { success: true, message: 'Seluruh memori pengguna telah dihapus secara permanen.' });
        return true;
      }

      let memoryId = pathname.replace('/api/memories/', '').trim();
      try { memoryId = decodeURIComponent(memoryId); } catch (_) {}
      if (!memoryId) {
        sendJson(res, 400, { success: false, error: 'ID memori wajib disertakan.' });
        return true;
      }
      const deleted = dbStorage.deleteMemory(memoryId, userId);
      if (!deleted) {
        sendJson(res, 404, { success: false, error: 'Memori tidak ditemukan atau bukan milik akun Anda.' });
        return true;
      }
      sendJson(res, 200, { success: true, deletedId: memoryId });
      return true;
    }
  } catch (err) {
    console.warn('[Jozz Memory Route Handler Warning]:', err);
    const statusCode = method === 'GET' ? 500 : 400;
    sendJson(res, statusCode, { success: false, error: err.message });
    return true;
  }

  return false;
}

module.exports = {
  handleMemoryRoutes
};
