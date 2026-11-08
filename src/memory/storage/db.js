/**
 * Jozz Memory - Hybrid Storage Layer (Graph + Vector + FTS5 SQLite)
 * Native node:sqlite & better-sqlite3 Repository Pattern
 * Resilient Multi-Tier Serverless Architecture
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('../config');
const { createEpisode, createEntity, createRelation, createMemoryItem } = require('../types');

let dbInstance = null;

// ==================== IN-MEMORY FALLBACK STORE ====================
// Digunakan hanya bila platform serverless tidak memiliki native SQLite binding sama sekali
const memStore = {
  episodes: new Map(),
  entities: new Map(),
  relations: new Map(),
  memories: new Map()
};

/**
 * Fast deterministic float32 embedding generator (dimension = 128)
 * Normalized cosine vector space for zero-config offline vector similarity.
 */
function computeFastEmbedding(text, dimension = config.EMBEDDING_DIMENSION) {
  const vec = new Float32Array(dimension);
  if (!text || typeof text !== 'string') return vec;

  const normalized = text.toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return vec;

  // 1. Unigram & Bigram frequency projection
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    let h = 2166136261;
    for (let j = 0; j < w.length; j++) {
      h ^= w.charCodeAt(j);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dimension;
    vec[idx] += 1.0;

    // Bigram
    if (i < words.length - 1) {
      const bi = `${w}_${words[i + 1]}`;
      let bh = 2166136261;
      for (let k = 0; k < bi.length; k++) {
        bh ^= bi.charCodeAt(k);
        bh = Math.imul(bh, 16777619);
      }
      const bIdx = Math.abs(bh) % dimension;
      vec[bIdx] += 1.5;
    }
  }

  // 2. L2 Normalization: ||v||_2 = 1.0
  let sumSq = 0.0;
  for (let i = 0; i < dimension; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq) || 1.0;
  for (let i = 0; i < dimension; i++) {
    vec[i] /= norm;
  }

  return vec;
}

/**
 * Cosine similarity between two float vectors
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0.0;
  let dot = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return Math.max(0.0, Math.min(1.0, dot));
}

/**
 * Initialize Jozz Memory SQLite Database with 4 main tables + FTS5
 * Multi-path graceful fallback: configured path -> tmpdir path -> in-memory SQLite -> JS store
 */
function initDatabase(dbPath = config.DB_PATH) {
  if (dbInstance) return dbInstance;

  let db = null;
  let isNative = false;
  let activeDbPath = dbPath;

  const candidatePaths = [
    dbPath,
    path.join(os.tmpdir(), '.zoz-router', 'jozz_memory.db'),
    path.join(os.tmpdir(), 'jozz_memory.db'),
    ':memory:'
  ];

  const uniqueCandidates = [...new Set(candidatePaths.filter(Boolean))];

  for (const candidate of uniqueCandidates) {
    try {
      if (candidate !== ':memory:') {
        const dir = path.dirname(candidate);
        if (!fs.existsSync(dir)) {
          try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
        }
      }

      // 1. Coba node:sqlite (Node.js 22+ native built-in)
      try {
        const { DatabaseSync } = require('node:sqlite');
        db = new DatabaseSync(candidate);
        isNative = true;
        activeDbPath = candidate;
        break;
      } catch (nativeErr) {
        // 2. Coba better-sqlite3 jika tersedia
        try {
          const Database = require('better-sqlite3');
          db = new Database(candidate);
          isNative = false;
          activeDbPath = candidate;
          break;
        } catch (_) {
          continue;
        }
      }
    } catch (_) {
      continue;
    }
  }

  // Jika SQLite tidak dapat diinisialisasi sama sekali pada sistem host
  if (!db) {
    console.warn('[Jozz Memory] SQLite engine tidak tersedia di environment ini, beralih ke in-memory store.');
    dbInstance = {
      db: null,
      isNative: false,
      mode: 'memory',
      close: () => {
        memStore.episodes.clear();
        memStore.entities.clear();
        memStore.relations.clear();
        memStore.memories.clear();
        dbInstance = null;
      }
    };
    return dbInstance;
  }

  // Safe PRAGMAs configuration
  try {
    if (config.isServerless || activeDbPath === ':memory:') {
      try { db.exec('PRAGMA journal_mode = MEMORY;'); } catch (_) {}
    } else {
      try { db.exec('PRAGMA journal_mode = WAL;'); } catch (_) {
        try { db.exec('PRAGMA journal_mode = DELETE;'); } catch (_) {}
      }
    }
    try { db.exec('PRAGMA synchronous = NORMAL;'); } catch (_) {}
    try { db.exec('PRAGMA foreign_keys = ON;'); } catch (_) {}
  } catch (_) {}

  // 1. Table: episodes (Receipts & Origin tracing)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT,
        turn_index INTEGER DEFAULT 0,
        source_type TEXT NOT NULL,
        source_title TEXT,
        source_uri TEXT,
        raw_snippet TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_episodes_user ON episodes(user_id);
    `);
  } catch (_) {}

  // 2. Table: entities (Knowledge Graph Nodes)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        entity_type TEXT DEFAULT 'concept',
        summary TEXT,
        scope TEXT DEFAULT 'global',
        embedding_json TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_entities_user_scope ON entities(user_id, scope);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
    `);
  } catch (_) {}

  // 3. Table: relations (Temporal Knowledge Graph Edges)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        source_entity_id TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        fact TEXT NOT NULL,
        valid_from TEXT NOT NULL,
        valid_until TEXT,
        episode_id TEXT,
        FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_relations_active ON relations(user_id, valid_until);
      CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_entity_id);
      CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_entity_id);
    `);
  } catch (_) {}

  // 4. Table: memories (Distilled Memories for User UI)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        scope TEXT DEFAULT 'global',
        confidence REAL DEFAULT 1.0,
        episode_id TEXT,
        embedding_json TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memories_user_active ON memories(user_id, is_active, scope);
      CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    `);
  } catch (_) {}

  // 5. Virtual Table: memories_fts (SQLite FTS5 BM25 Search)
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        memory_id UNINDEXED,
        user_id UNINDEXED,
        scope UNINDEXED,
        content,
        category
      );
    `);
  } catch (ftsErr) {
    // FTS5 optional
  }

  dbInstance = {
    db,
    isNative,
    mode: 'sqlite',
    activeDbPath,
    close: () => {
      try { db.close(); } catch (_) {}
      dbInstance = null;
    }
  };

  return dbInstance;
}

/**
 * Universal query runner across node:sqlite (prepare().all()) and better-sqlite3
 */
function queryAll(stmt, ...params) {
  if (!stmt) return [];
  if (typeof stmt.all === 'function') {
    return stmt.all(...params);
  }
  return [];
}

function queryGet(stmt, ...params) {
  if (!stmt) return null;
  if (typeof stmt.get === 'function') {
    return stmt.get(...params);
  }
  const all = queryAll(stmt, ...params);
  return all.length > 0 ? all[0] : null;
}

function queryRun(stmt, ...params) {
  if (!stmt) return null;
  if (typeof stmt.run === 'function') {
    return stmt.run(...params);
  }
  return null;
}

// ==================== EPISODES API ====================

function insertEpisode(episodeData) {
  const ep = createEpisode(episodeData);
  const instance = initDatabase();

  if (instance.mode === 'memory') {
    memStore.episodes.set(ep.id, ep);
    return ep;
  }

  const { db } = instance;
  const stmt = db.prepare(`
    INSERT INTO episodes (id, user_id, session_id, turn_index, source_type, source_title, source_uri, raw_snippet, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  queryRun(stmt, ep.id, ep.userId, ep.sessionId, ep.turnIndex, ep.sourceType, ep.sourceTitle, ep.sourceUri, ep.rawSnippet, ep.createdAt);
  return ep;
}

function getEpisodeById(episodeId) {
  if (!episodeId) return null;
  const instance = initDatabase();

  if (instance.mode === 'memory') {
    return memStore.episodes.get(episodeId) || null;
  }

  const { db } = instance;
  const stmt = db.prepare('SELECT * FROM episodes WHERE id = ? LIMIT 1');
  return queryGet(stmt, episodeId);
}

// ==================== ENTITIES API ====================

function upsertEntity(entityData) {
  const ent = createEntity(entityData);
  if (!ent.embeddingJson) {
    const vec = computeFastEmbedding(`${ent.name} ${ent.summary}`);
    ent.embeddingJson = JSON.stringify(Array.from(vec));
  }
  const instance = initDatabase();

  if (instance.mode === 'memory') {
    let existingId = null;
    for (const [id, e] of memStore.entities.entries()) {
      if (e.userId === ent.userId && e.name.toLowerCase() === ent.name.toLowerCase() && e.scope === ent.scope) {
        existingId = id;
        break;
      }
    }
    if (existingId) {
      const merged = { ...memStore.entities.get(existingId), summary: ent.summary, entityType: ent.entityType, embeddingJson: ent.embeddingJson, updatedAt: ent.updatedAt };
      memStore.entities.set(existingId, merged);
      return merged;
    } else {
      memStore.entities.set(ent.id, ent);
      return ent;
    }
  }

  const { db } = instance;
  const existingStmt = db.prepare('SELECT id FROM entities WHERE user_id = ? AND lower(name) = lower(?) AND scope = ? LIMIT 1');
  const existing = queryGet(existingStmt, ent.userId, ent.name, ent.scope);

  if (existing) {
    const updateStmt = db.prepare(`
      UPDATE entities 
      SET summary = ?, entity_type = ?, embedding_json = ?, updated_at = ?
      WHERE id = ?
    `);
    queryRun(updateStmt, ent.summary, ent.entityType, ent.embeddingJson, ent.updatedAt, existing.id);
    return { ...ent, id: existing.id };
  } else {
    const insertStmt = db.prepare(`
      INSERT INTO entities (id, user_id, name, entity_type, summary, scope, embedding_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    queryRun(insertStmt, ent.id, ent.userId, ent.name, ent.entityType, ent.summary, ent.scope, ent.embeddingJson, ent.updatedAt);
    return ent;
  }
}

function findEntityByName(userId, name, scope = 'global') {
  const instance = initDatabase();

  if (instance.mode === 'memory') {
    const target = (name || '').toLowerCase();
    for (const e of memStore.entities.values()) {
      if ((e.userId === userId || e.userId === 'default') && e.name.toLowerCase() === target && (e.scope === scope || e.scope === 'global')) {
        return e;
      }
    }
    return null;
  }

  const { db } = instance;
  const stmt = db.prepare("SELECT * FROM entities WHERE user_id = ? AND lower(name) = lower(?) AND (scope = ? OR scope = 'global') LIMIT 1");
  return queryGet(stmt, userId, name, scope);
}

// ==================== RELATIONS API (TEMPORAL GRAPH) ====================

function addRelation(relationData, { resolveConflict = true } = {}) {
  const rel = createRelation(relationData);
  const instance = initDatabase();

  if (instance.mode === 'memory') {
    if (resolveConflict) {
      const now = new Date().toISOString();
      for (const r of memStore.relations.values()) {
        if (r.userId === rel.userId && r.sourceEntityId === rel.sourceEntityId && r.targetEntityId === rel.targetEntityId && r.relationType === rel.relationType && !r.validUntil) {
          r.validUntil = now;
        }
      }
    }
    memStore.relations.set(rel.id, rel);
    return rel;
  }

  const { db } = instance;

  if (resolveConflict) {
    const activeStmt = db.prepare(`
      SELECT id FROM relations 
      WHERE user_id = ? AND source_entity_id = ? AND target_entity_id = ? AND relation_type = ? AND valid_until IS NULL
    `);
    const activeRows = queryAll(activeStmt, rel.userId, rel.sourceEntityId, rel.targetEntityId, rel.relationType);
    if (activeRows && activeRows.length > 0) {
      const now = new Date().toISOString();
      const expireStmt = db.prepare('UPDATE relations SET valid_until = ? WHERE id = ?');
      for (const row of activeRows) {
        queryRun(expireStmt, now, row.id);
      }
    }
  }

  const insertStmt = db.prepare(`
    INSERT INTO relations (id, user_id, source_entity_id, target_entity_id, relation_type, fact, valid_from, valid_until, episode_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  queryRun(insertStmt, rel.id, rel.userId, rel.sourceEntityId, rel.targetEntityId, rel.relationType, rel.fact, rel.validFrom, rel.validUntil, rel.episodeId);
  return rel;
}

function traverseActiveGraph(userId, entityId, maxHops = 2) {
  const instance = initDatabase();

  if (instance.mode === 'memory') {
    const visitedNodes = new Set([entityId]);
    const matchedRelations = [];
    let currentTier = [entityId];

    for (let hop = 0; hop < maxHops; hop++) {
      if (currentTier.length === 0) break;
      const nextTier = [];
      for (const nodeId of currentTier) {
        for (const r of memStore.relations.values()) {
          if (r.userId === userId && (r.sourceEntityId === nodeId || r.targetEntityId === nodeId) && !r.validUntil) {
            if (!matchedRelations.some(m => m.id === r.id)) {
              matchedRelations.push(r);
            }
            const neighbor = r.sourceEntityId === nodeId ? r.targetEntityId : r.sourceEntityId;
            if (!visitedNodes.has(neighbor)) {
              visitedNodes.add(neighbor);
              nextTier.push(neighbor);
            }
          }
        }
      }
      currentTier = nextTier;
    }
    return matchedRelations;
  }

  const { db } = instance;
  const visitedNodes = new Set([entityId]);
  const matchedRelations = [];

  let currentTier = [entityId];
  for (let hop = 0; hop < maxHops; hop++) {
    if (currentTier.length === 0) break;
    const nextTier = [];
    for (const nodeId of currentTier) {
      const stmt = db.prepare(`
        SELECT r.*, e1.name as source_name, e2.name as target_name 
        FROM relations r
        LEFT JOIN entities e1 ON r.source_entity_id = e1.id
        LEFT JOIN entities e2 ON r.target_entity_id = e2.id
        WHERE r.user_id = ? AND (r.source_entity_id = ? OR r.target_entity_id = ?) AND r.valid_until IS NULL
      `);
      const rows = queryAll(stmt, userId, nodeId, nodeId);
      for (const row of rows) {
        if (!matchedRelations.some(m => m.id === row.id)) {
          matchedRelations.push(row);
        }
        const neighbor = row.source_entity_id === nodeId ? row.target_entity_id : row.source_entity_id;
        if (!visitedNodes.has(neighbor)) {
          visitedNodes.add(neighbor);
          nextTier.push(neighbor);
        }
      }
    }
    currentTier = nextTier;
  }

  return matchedRelations;
}

// ==================== MEMORIES API ====================

function insertMemory(memoryData) {
  const mem = createMemoryItem(memoryData);
  if (!mem.embeddingJson) {
    const vec = computeFastEmbedding(`${mem.content} ${mem.category} ${mem.scope}`);
    mem.embeddingJson = JSON.stringify(Array.from(vec));
  }
  const instance = initDatabase();

  if (instance.mode === 'memory') {
    memStore.memories.set(mem.id, mem);
    return mem;
  }

  const { db } = instance;

  const insertStmt = db.prepare(`
    INSERT INTO memories (id, user_id, content, category, scope, confidence, episode_id, embedding_json, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  queryRun(insertStmt, mem.id, mem.userId, mem.content, mem.category, mem.scope, mem.confidence, mem.episodeId, mem.embeddingJson, mem.isActive, mem.createdAt, mem.updatedAt);

  // Sync to FTS5 virtual table
  try {
    const ftsStmt = db.prepare(`
      INSERT INTO memories_fts (memory_id, user_id, scope, content, category)
      VALUES (?, ?, ?, ?, ?)
    `);
    queryRun(ftsStmt, mem.id, mem.userId, mem.scope, mem.content, mem.category);
  } catch (_) {}

  return mem;
}

function updateMemory(id, { content, category, scope, isActive }) {
  const instance = initDatabase();

  if (instance.mode === 'memory') {
    const existing = memStore.memories.get(id);
    if (!existing) return null;

    const newContent = typeof content === 'string' ? content.trim() : existing.content;
    const newCat = typeof category === 'string' ? category.trim() : existing.category;
    const newScope = typeof scope === 'string' ? scope.trim() : existing.scope;
    const newActive = typeof isActive !== 'undefined' ? (isActive ? 1 : 0) : existing.is_active;
    const updatedAt = new Date().toISOString();

    let newEmb = existing.embedding_json;
    if (newContent !== existing.content) {
      const vec = computeFastEmbedding(`${newContent} ${newCat} ${newScope}`);
      newEmb = JSON.stringify(Array.from(vec));
    }

    const updated = { ...existing, content: newContent, category: newCat, scope: newScope, is_active: newActive, is_active_bool: Boolean(newActive), embedding_json: newEmb, updated_at: updatedAt };
    memStore.memories.set(id, updated);
    return updated;
  }

  const { db } = instance;
  const existingStmt = db.prepare('SELECT * FROM memories WHERE id = ? LIMIT 1');
  const existing = queryGet(existingStmt, id);
  if (!existing) return null;

  const newContent = typeof content === 'string' ? content.trim() : existing.content;
  const newCat = typeof category === 'string' ? category.trim() : existing.category;
  const newScope = typeof scope === 'string' ? scope.trim() : existing.scope;
  const newActive = typeof isActive !== 'undefined' ? (isActive ? 1 : 0) : existing.is_active;
  const updatedAt = new Date().toISOString();

  let newEmb = existing.embedding_json;
  if (newContent !== existing.content) {
    const vec = computeFastEmbedding(`${newContent} ${newCat} ${newScope}`);
    newEmb = JSON.stringify(Array.from(vec));
  }

  const updateStmt = db.prepare(`
    UPDATE memories 
    SET content = ?, category = ?, scope = ?, is_active = ?, embedding_json = ?, updated_at = ?
    WHERE id = ?
  `);
  queryRun(updateStmt, newContent, newCat, newScope, newActive, newEmb, updatedAt, id);

  // Update FTS5
  try {
    const delFts = db.prepare('DELETE FROM memories_fts WHERE memory_id = ?');
    queryRun(delFts, id);
    if (newActive) {
      const insFts = db.prepare('INSERT INTO memories_fts (memory_id, user_id, scope, content, category) VALUES (?, ?, ?, ?, ?)');
      queryRun(insFts, id, existing.user_id, newScope, newContent, newCat);
    }
  } catch (_) {}

  return { ...existing, content: newContent, category: newCat, scope: newScope, is_active: newActive, updated_at: updatedAt };
}

function deleteMemory(id) {
  const instance = initDatabase();

  if (instance.mode === 'memory') {
    memStore.memories.delete(id);
    return true;
  }

  const { db } = instance;
  const stmt = db.prepare('DELETE FROM memories WHERE id = ?');
  queryRun(stmt, id);

  try {
    const delFts = db.prepare('DELETE FROM memories_fts WHERE memory_id = ?');
    queryRun(delFts, id);
  } catch (_) {}

  return true;
}

function clearAllMemories(userId) {
  const instance = initDatabase();
  const uid = userId || config.DEFAULT_USER_ID;

  if (instance.mode === 'memory') {
    for (const [id, m] of memStore.memories.entries()) {
      if (m.userId === uid || m.user_id === uid) memStore.memories.delete(id);
    }
    for (const [id, r] of memStore.relations.entries()) {
      if (r.userId === uid || r.user_id === uid) memStore.relations.delete(id);
    }
    for (const [id, e] of memStore.entities.entries()) {
      if (e.userId === uid || e.user_id === uid) memStore.entities.delete(id);
    }
    for (const [id, ep] of memStore.episodes.entries()) {
      if (ep.userId === uid || ep.user_id === uid) memStore.episodes.delete(id);
    }
    return true;
  }

  const { db } = instance;
  db.exec('BEGIN TRANSACTION;');
  try {
    const delMem = db.prepare('DELETE FROM memories WHERE user_id = ?');
    queryRun(delMem, uid);
    try {
      const delFts = db.prepare('DELETE FROM memories_fts WHERE user_id = ?');
      queryRun(delFts, uid);
    } catch (_) {}
    const delRel = db.prepare('DELETE FROM relations WHERE user_id = ?');
    queryRun(delRel, uid);
    const delEnt = db.prepare('DELETE FROM entities WHERE user_id = ?');
    queryRun(delEnt, uid);
    const delEp = db.prepare('DELETE FROM episodes WHERE user_id = ?');
    queryRun(delEp, uid);
    db.exec('COMMIT;');
    return true;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function listMemories(userId, { category = null, scope = null, q = null, limit = 50 } = {}) {
  const instance = initDatabase();
  const uid = userId || config.DEFAULT_USER_ID;
  const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 50, 200));
  const normCat = category ? (category === 'general_fact' ? 'fact' : category) : null;

  if (instance.mode === 'memory') {
    let list = Array.from(memStore.memories.values()).filter(m => (m.userId === uid || m.user_id === uid));
    if (normCat) {
      if (normCat === 'fact') {
        list = list.filter(m => m.category === 'fact' || m.category === 'general_fact' || m.category === 'general');
      } else {
        list = list.filter(m => m.category === normCat);
      }
    }
    if (scope) {
      list = list.filter(m => m.scope === scope || m.scope === 'global');
    }
    if (q && q.trim()) {
      const qLower = q.trim().toLowerCase();
      list = list.filter(m => (m.content || '').toLowerCase().includes(qLower));
    }
    list.sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));
    return list.slice(0, safeLimit);
  }

  const { db } = instance;
  let sql = 'SELECT * FROM memories WHERE user_id = ?';
  const params = [uid];

  if (normCat) {
    if (normCat === 'fact') {
      sql += " AND (category = 'fact' OR category = 'general_fact' OR category = 'general')";
    } else {
      sql += ' AND category = ?';
      params.push(normCat);
    }
  }
  if (scope) {
    sql += " AND (scope = ? OR scope = 'global')";
    params.push(scope);
  }
  if (q && q.trim()) {
    sql += ' AND content LIKE ?';
    params.push(`%${q.trim()}%`);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(safeLimit);

  const stmt = db.prepare(sql);
  return queryAll(stmt, ...params);
}

// ==================== SEARCH SIGNALS FOR RECALL ====================

function searchMemoriesFTS5(userId, queryText, scope = 'global', limit = 10) {
  const instance = initDatabase();
  const cleanTokens = (queryText || '').replace(/[^\p{L}\p{N}_]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 10);
  if (cleanTokens.length === 0) return [];

  if (instance.mode === 'memory') {
    const list = Array.from(memStore.memories.values()).filter(m => {
      const isOwner = (m.userId === userId || m.user_id === userId || m.userId === 'default' || m.user_id === 'default');
      const isActive = m.isActive !== undefined ? m.isActive : m.is_active;
      const isScope = (m.scope === scope || m.scope === 'global');
      if (!isOwner || !isActive || !isScope) return false;
      const c = (m.content || '').toLowerCase();
      return cleanTokens.some(tok => c.includes(tok.toLowerCase()));
    });
    return list.slice(0, limit);
  }

  const { db } = instance;
  const ftsMatch = cleanTokens.map(w => `"${w}"*`).join(' OR ');

  try {
    const stmt = db.prepare(`
      SELECT m.*, fts.rank as bm25_rank
      FROM memories_fts fts
      JOIN memories m ON m.id = fts.memory_id
      WHERE fts.memories_fts MATCH ? 
        AND (m.user_id = ? OR m.user_id = 'default')
        AND m.is_active = 1
        AND (m.scope = ? OR m.scope = 'global')
      ORDER BY fts.rank ASC
      LIMIT ?
    `);
    return queryAll(stmt, ftsMatch, userId, scope, limit);
  } catch (_) {
    // Fallback LIKE search if FTS5 table is disabled
    const stmt = db.prepare(`
      SELECT * FROM memories 
      WHERE (user_id = ? OR user_id = 'default') AND is_active = 1 AND (scope = ? OR scope = 'global')
        AND (${cleanTokens.map(() => 'content LIKE ?').join(' OR ')})
      ORDER BY created_at DESC LIMIT ?
    `);
    const likeParams = cleanTokens.map(w => `%${w}%`);
    return queryAll(stmt, userId, scope, ...likeParams, limit);
  }
}

function searchMemoriesVector(userId, queryVec, scope = 'global', limit = 10) {
  const instance = initDatabase();

  if (instance.mode === 'memory') {
    const rows = Array.from(memStore.memories.values()).filter(m => {
      const isOwner = (m.userId === userId || m.user_id === userId || m.userId === 'default' || m.user_id === 'default');
      const isActive = m.isActive !== undefined ? m.isActive : m.is_active;
      const isScope = (m.scope === scope || m.scope === 'global');
      return isOwner && isActive && isScope;
    });

    const scored = [];
    for (const row of rows) {
      const emb = row.embeddingJson || row.embedding_json;
      if (!emb) continue;
      try {
        const vec = new Float32Array(typeof emb === 'string' ? JSON.parse(emb) : emb);
        const sim = cosineSimilarity(queryVec, vec);
        scored.push({ ...row, vector_similarity: sim });
      } catch (_) {}
    }
    scored.sort((a, b) => b.vector_similarity - a.vector_similarity);
    return scored.slice(0, limit);
  }

  const { db } = instance;
  const stmt = db.prepare(`
    SELECT * FROM memories 
    WHERE (user_id = ? OR user_id = 'default') AND is_active = 1 AND (scope = ? OR scope = 'global')
  `);
  const rows = queryAll(stmt, userId, scope);
  if (!rows || rows.length === 0) return [];

  const scored = [];
  for (const row of rows) {
    if (!row.embedding_json) continue;
    try {
      const vec = new Float32Array(JSON.parse(row.embedding_json));
      const sim = cosineSimilarity(queryVec, vec);
      scored.push({ ...row, vector_similarity: sim });
    } catch (_) {}
  }

  scored.sort((a, b) => b.vector_similarity - a.vector_similarity);
  return scored.slice(0, limit);
}

module.exports = {
  computeFastEmbedding,
  cosineSimilarity,
  initDatabase,
  insertEpisode,
  getEpisodeById,
  upsertEntity,
  findEntityByName,
  addRelation,
  traverseActiveGraph,
  insertMemory,
  updateMemory,
  deleteMemory,
  clearAllMemories,
  listMemories,
  searchMemoriesFTS5,
  searchMemoriesVector
};
