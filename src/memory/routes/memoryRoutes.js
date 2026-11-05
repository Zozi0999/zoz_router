/**
 * Jozz Memory - HTTP API Router
 * Handles all /api/memories endpoints seamlessly with zero external router dependencies.
 */

const dbStorage = require('../storage/db');
const retriever = require('../pipeline/retriever');
const extractor = require('../pipeline/extractor');
const insights = require('../pipeline/insights');
const porter = require('../sovereignty/porter');

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (_) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function parseRawBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => resolve(body || ''));
    req.on('error', () => resolve(''));
  });
}

/**
 * Handle memory routes. Returns true if handled, false if path did not match.
 */
async function handleMemoryRoutes(req, res, reqUrl) {
  const pathname = reqUrl.pathname;
  const method = req.method;

  if (!pathname.startsWith('/api/memories')) {
    return false;
  }

  const userId = req.headers['x-user-id'] || reqUrl.searchParams.get('userId') || 'default';

  try {
    // 1. GET /api/memories/insights
    if (method === 'GET' && pathname === '/api/memories/insights') {
      const scope = reqUrl.searchParams.get('scope') || null;
      const data = insights.generateMemoryInsights(userId, scope);
      sendJson(res, 200, { success: true, data });
      return true;
    }

    // 2. GET /api/memories/receipts/:episodeId
    if (method === 'GET' && pathname.startsWith('/api/memories/receipts/')) {
      const episodeId = pathname.replace('/api/memories/receipts/', '').trim();
      const episode = dbStorage.getEpisodeById(episodeId);
      if (!episode) {
        sendJson(res, 404, { success: false, error: 'Episode receipt tidak ditemukan.' });
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

      const recallResult = retriever.recallMemories(userId, query, scope);
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
      const incognito = Boolean(body.incognito);
      if (!incognito) {
        extractor.triggerAsyncBackgroundExtraction({
          userId,
          sessionId: body.sessionId || 'default',
          turnIndex: body.turnIndex || 0,
          userMessage: body.userMessage || body.message || '',
          assistantResponse: body.assistantResponse || '',
          scope: body.scope || 'global'
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
      const content = body.content || body.fact || '';
      const scope = body.scope || 'global';

      if (!content || !content.trim()) {
        sendJson(res, 400, { success: false, error: 'Isi memori (content) wajib diisi.' });
        return true;
      }

      const resCapture = extractor.captureExplicitMemory(userId, content, scope, {
        sessionId: body.sessionId || 'manual',
        sourceType: 'manual',
        sourceTitle: body.sourceTitle || 'Input Manual Pengguna'
      });

      sendJson(res, resCapture.success ? 201 : 400, resCapture);
      return true;
    }

    // 9. PATCH /api/memories/:id (Edit memory)
    if (method === 'PATCH' && pathname.startsWith('/api/memories/')) {
      const memoryId = pathname.replace('/api/memories/', '').trim();
      const body = await parseJsonBody(req);
      const updated = dbStorage.updateMemory(memoryId, body);
      if (!updated) {
        sendJson(res, 404, { success: false, error: 'Memori tidak ditemukan.' });
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

      const memoryId = pathname.replace('/api/memories/', '').trim();
      dbStorage.deleteMemory(memoryId);
      sendJson(res, 200, { success: true, deletedId: memoryId });
      return true;
    }
  } catch (err) {
    console.warn('[Jozz Memory Route Handler Warning]:', err);
    if (method === 'GET') {
      sendJson(res, 200, { success: true, count: 0, memories: [], warning: err.message });
      return true;
    }
    sendJson(res, 400, { success: false, error: err.message });
    return true;
  }

  return false;
}

module.exports = {
  handleMemoryRoutes
};
