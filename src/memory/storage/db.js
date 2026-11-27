/**
 * Jozz Memory - Hybrid Storage Layer (Graph + Vector + FTS5 SQLite)
 * Native node:sqlite & better-sqlite3 Repository Pattern
 * Resilient Multi-Tier Serverless Architecture
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('../config');
const { createEpisode, createEntity, createRelation, createMemoryItem, validateCategory, validateScope } = require('../types');

function escapeSqlLike(str) {
  return String(str || '').replace(/[\\%_]/g, '\\$&');
}

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

  const normalized = text.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s_]/gu, ' ');
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

function isRecordOwnedBy(record, userId) {
  if (!record || !userId || userId === '*') return false;
  return (record.userId || record.user_id || config.DEFAULT_USER_ID) === userId;
}

function normalizeMemoryRow(m) {
  if (!m) return null;
  const uid = m.user_id || m.userId || config.DEFAULT_USER_ID;
  const isAct = m.isActive !== undefined ? (m.isActive ? 1 : 0) : (m.is_active !== undefined ? (m.is_active ? 1 : 0) : 1);
  const epId = m.episode_id !== undefined ? m.episode_id : (m.episodeId || null);
  const emb = m.embedding_json !== undefined ? m.embedding_json : (m.embeddingJson || null);
  const createdAt = m.created_at || m.createdAt || new Date().toISOString();
  const updatedAt = m.updated_at || m.updatedAt || createdAt;
  return {
    ...m,
    userId: uid,
    user_id: uid,
    episodeId: epId,
    episode_id: epId,
    embeddingJson: emb,
    embedding_json: emb,
    isActive: isAct,
    is_active: isAct,
    createdAt,
    created_at: createdAt,
    updatedAt,
    updated_at: updatedAt
  };
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

function getEpisodeById(episodeId, userId = null) {
  if (!episodeId) return null;
  const instance = initDatabase();

  if (instance.mode === 'memory') {
    const ep = memStore.episodes.get(episodeId) || null;
    if (ep && userId && userId !== '*' && ep.userId !== userId) {
      return null;
    }
    return ep;
  }

  const { db } = instance;
  if (userId && userId !== '*') {
    const stmt = db.prepare('SELECT * FROM episodes WHERE id = ? AND user_id = ? LIMIT 1');
    return queryGet(stmt, episodeId, userId);
  }
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

function findEntityByName(userId, name, scope = 'global', { strictProjectScope = false } = {}) {
  const { validateScope, isProjectScope } = require('../types');
  const instance = initDatabase();
  const normScope = scope ? validateScope(scope) : 'global';
  const strict = Boolean((strictProjectScope || isProjectScope(normScope)) && normScope !== 'global');

  if (instance.mode === 'memory') {
    const target = (name || '').toLowerCase();
    for (const e of memStore.entities.values()) {
      const eScope = validateScope(e.scope || 'global');
      const scopeOk = strict ? (eScope === normScope) : (eScope === normScope || eScope === 'global');
      if (isRecordOwnedBy(e, userId) && e.name.toLowerCase() === target && scopeOk) {
        return e;
      }
    }
    return null;
  }

  const { db } = instance;
  const sql = strict
    ? 'SELECT * FROM entities WHERE user_id = ? AND lower(name) = lower(?) AND scope = ? LIMIT 1'
    : "SELECT * FROM entities WHERE user_id = ? AND lower(name) = lower(?) AND (scope = ? OR scope = 'global') LIMIT 1";
  const stmt = db.prepare(sql);
  return queryGet(stmt, userId, name, normScope);
}

// ==================== RELATIONS API (TEMPORAL GRAPH) ====================

function addRelation(relationData, { resolveConflict = true } = {}) {
  const rel = createRelation(relationData);
  const instance = initDatabase();

  if (instance.mode === 'memory') {
    if (resolveConflict) {
      const now = new Date().toISOString();
      for (const r of memStore.relations.values()) {
        if (r.userId !== rel.userId || r.validUntil) continue;
        if (r.sourceEntityId === rel.sourceEntityId && r.relationType === rel.relationType) {
          r.validUntil = now;
        } else if (rel.relationType === 'replaces' && (r.targetEntityId === rel.targetEntityId || r.sourceEntityId === rel.targetEntityId)) {
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
      WHERE user_id = ? AND (
        (source_entity_id = ? AND relation_type = ?)
        OR (? = 'replaces' AND (target_entity_id = ? OR source_entity_id = ?))
      ) AND valid_until IS NULL
    `);
    const activeRows = queryAll(activeStmt, rel.userId, rel.sourceEntityId, rel.relationType, rel.relationType, rel.targetEntityId, rel.targetEntityId);
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

function traverseActiveGraph(userId, entityId, maxHops = 2, scope = null, { strictProjectScope = false } = {}) {
  const { validateScope, isProjectScope } = require('../types');
  const instance = initDatabase();
  const normScope = scope ? validateScope(scope) : null;
  const strict = Boolean(normScope && (strictProjectScope || isProjectScope(normScope)) && normScope !== 'global');

  if (instance.mode === 'memory') {
    const visitedNodes = new Set([entityId]);
    const matchedRelations = [];
    let currentTier = [entityId];
    const isEntityInScope = (eid) => {
      if (!normScope) return true;
      const ent = memStore.entities.get(eid);
      if (!ent) return false;
      const eScope = validateScope(ent.scope || 'global');
      return strict ? (eScope === normScope) : (eScope === normScope || eScope === 'global');
    };

    for (let hop = 0; hop < maxHops; hop++) {
      if (currentTier.length === 0) break;
      const nextTier = [];
      for (const nodeId of currentTier) {
        for (const r of memStore.relations.values()) {
          if (r.userId === userId && (r.sourceEntityId === nodeId || r.targetEntityId === nodeId) && !r.validUntil) {
            if (!isEntityInScope(r.sourceEntityId) || !isEntityInScope(r.targetEntityId)) continue;
            if (!matchedRelations.some(m => m.id === r.id)) {
              const srcEnt = memStore.entities.get(r.sourceEntityId);
              const tgtEnt = memStore.entities.get(r.targetEntityId);
              matchedRelations.push({
                ...r,
                source_scope: srcEnt ? validateScope(srcEnt.scope || 'global') : 'global',
                target_scope: tgtEnt ? validateScope(tgtEnt.scope || 'global') : 'global'
              });
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
      let sql = `
        SELECT r.*, e1.name as source_name, e2.name as target_name, e1.scope as source_scope, e2.scope as target_scope
        FROM relations r
        LEFT JOIN entities e1 ON r.source_entity_id = e1.id
        LEFT JOIN entities e2 ON r.target_entity_id = e2.id
        WHERE r.user_id = ? AND (r.source_entity_id = ? OR r.target_entity_id = ?) AND r.valid_until IS NULL
      `;
      const params = [userId, nodeId, nodeId];
      if (normScope) {
        if (strict) {
          sql += ' AND e1.scope = ? AND e2.scope = ?';
        } else {
          sql += " AND (e1.scope = ? OR e1.scope = 'global') AND (e2.scope = ? OR e2.scope = 'global')";
        }
        params.push(normScope, normScope);
      }
      const stmt = db.prepare(sql);
      const rows = queryAll(stmt, ...params);
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
    const normalized = normalizeMemoryRow(mem);
    memStore.memories.set(normalized.id, normalized);
    return normalized;
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

function updateMemory(id, { content, category, scope, isActive }, userId = null) {
  const instance = initDatabase();
  const scopedOwner = Boolean(userId && userId !== '*');

  if (instance.mode === 'memory') {
    const existing = memStore.memories.get(id);
    if (!existing || (scopedOwner && !isRecordOwnedBy(existing, userId))) return null;

    const prevActive = existing.isActive !== undefined ? existing.isActive : existing.is_active;
    const prevEmb = existing.embeddingJson !== undefined ? existing.embeddingJson : existing.embedding_json;
    const trimmedContent = typeof content === 'string' ? content.trim() : '';
    const trimmedCat = typeof category === 'string' ? category.trim() : '';
    const trimmedScope = typeof scope === 'string' ? scope.trim() : '';
    const newContent = trimmedContent || existing.content;
    const newCat = trimmedCat ? validateCategory(trimmedCat) : existing.category;
    const newScope = trimmedScope ? validateScope(trimmedScope) : existing.scope;
    const newActive = typeof isActive !== 'undefined' ? (isActive ? 1 : 0) : prevActive;
    const updatedAt = new Date().toISOString();

    let newEmb = prevEmb;
    if (newContent !== existing.content || newCat !== existing.category || newScope !== existing.scope) {
      const vec = computeFastEmbedding(`${newContent} ${newCat} ${newScope}`);
      newEmb = JSON.stringify(Array.from(vec));
    }

    const updated = normalizeMemoryRow({
      ...existing,
      content: newContent,
      category: newCat,
      scope: newScope,
      isActive: newActive,
      is_active: newActive,
      is_active_bool: Boolean(newActive),
      embeddingJson: newEmb,
      embedding_json: newEmb,
      updatedAt,
      updated_at: updatedAt
    });
    memStore.memories.set(id, updated);
    return updated;
  }

  const { db } = instance;
  const existingStmt = scopedOwner
    ? db.prepare('SELECT * FROM memories WHERE id = ? AND user_id = ? LIMIT 1')
    : db.prepare('SELECT * FROM memories WHERE id = ? LIMIT 1');
  const existing = scopedOwner ? queryGet(existingStmt, id, userId) : queryGet(existingStmt, id);
  if (!existing) return null;

  const trimmedContent = typeof content === 'string' ? content.trim() : '';
  const trimmedCat = typeof category === 'string' ? category.trim() : '';
  const trimmedScope = typeof scope === 'string' ? scope.trim() : '';
  const newContent = trimmedContent || existing.content;
  const newCat = trimmedCat ? validateCategory(trimmedCat) : existing.category;
  const newScope = trimmedScope ? validateScope(trimmedScope) : existing.scope;
  const newActive = typeof isActive !== 'undefined' ? (isActive ? 1 : 0) : existing.is_active;
  const updatedAt = new Date().toISOString();

  let newEmb = existing.embedding_json;
  if (newContent !== existing.content || newCat !== existing.category || newScope !== existing.scope) {
    const vec = computeFastEmbedding(`${newContent} ${newCat} ${newScope}`);
    newEmb = JSON.stringify(Array.from(vec));
  }

  const updateStmt = scopedOwner
    ? db.prepare(`
        UPDATE memories 
        SET content = ?, category = ?, scope = ?, is_active = ?, embedding_json = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `)
    : db.prepare(`
        UPDATE memories 
        SET content = ?, category = ?, scope = ?, is_active = ?, embedding_json = ?, updated_at = ?
        WHERE id = ?
      `);
  if (scopedOwner) {
    queryRun(updateStmt, newContent, newCat, newScope, newActive, newEmb, updatedAt, id, userId);
  } else {
    queryRun(updateStmt, newContent, newCat, newScope, newActive, newEmb, updatedAt, id);
  }

  // Update FTS5
  try {
    const delFts = db.prepare('DELETE FROM memories_fts WHERE memory_id = ?');
    queryRun(delFts, id);
    if (newActive) {
      const insFts = db.prepare('INSERT INTO memories_fts (memory_id, user_id, scope, content, category) VALUES (?, ?, ?, ?, ?)');
      queryRun(insFts, id, existing.user_id, newScope, newContent, newCat);
    }
  } catch (_) {}

  return normalizeMemoryRow({
    ...existing,
    content: newContent,
    category: newCat,
    scope: newScope,
    is_active: newActive,
    embedding_json: newEmb,
    updated_at: updatedAt
  });
}

function deleteMemory(id, userId = null) {
  const instance = initDatabase();
  const scopedOwner = Boolean(userId && userId !== '*');

  if (instance.mode === 'memory') {
    const existing = memStore.memories.get(id);
    if (!existing || (scopedOwner && !isRecordOwnedBy(existing, userId))) return false;
    memStore.memories.delete(id);
    return true;
  }

  const { db } = instance;
  const stmt = scopedOwner
    ? db.prepare('DELETE FROM memories WHERE id = ? AND user_id = ?')
    : db.prepare('DELETE FROM memories WHERE id = ?');
  const info = scopedOwner ? queryRun(stmt, id, userId) : queryRun(stmt, id);
  const removed = Number(info && (info.changes ?? info.rowCount ?? 0)) > 0;
  if (!removed) return false;

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

function listMemories(userId, { category = null, scope = null, strictProjectScope = false, q = null, limit = 50, allowLargeLimit = false } = {}) {
  const { validateScope, isProjectScope } = require('../types');
  const instance = initDatabase();
  const uid = userId || config.DEFAULT_USER_ID;
  const maxCap = allowLargeLimit ? 5000 : 200;
  const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 50, maxCap));
  const normCat = category ? (category === 'general_fact' ? 'fact' : category) : null;
  const normScope = scope ? validateScope(scope) : null;
  const strict = Boolean(normScope && (strictProjectScope || isProjectScope(normScope)) && normScope !== 'global');

  if (instance.mode === 'memory') {
    let list = Array.from(memStore.memories.values())
      .filter(m => isRecordOwnedBy(m, uid) && m.is_active !== 0 && m.isActive !== 0 && m.is_active !== false)
      .map(normalizeMemoryRow);
    if (normCat) {
      if (normCat === 'fact') {
        list = list.filter(m => m.category === 'fact' || m.category === 'general_fact' || m.category === 'general');
      } else {
        list = list.filter(m => m.category === normCat);
      }
    }
    if (normScope) {
      list = list.filter(m => {
        const ms = validateScope(m.scope || 'global');
        return strict ? (ms === normScope) : (ms === normScope || ms === 'global');
      });
    }
    if (q && q.trim()) {
      const qLower = q.trim().toLowerCase();
      list = list.filter(m => (m.content || '').toLowerCase().includes(qLower));
    }
    list.sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));
    return list.slice(0, safeLimit);
  }

  const { db } = instance;
  let sql = 'SELECT * FROM memories WHERE user_id = ? AND is_active = 1';
  const params = [uid];

  if (normCat) {
    if (normCat === 'fact') {
      sql += " AND (category = 'fact' OR category = 'general_fact' OR category = 'general')";
    } else {
      sql += ' AND category = ?';
      params.push(normCat);
    }
  }
  if (normScope) {
    sql += strict ? ' AND scope = ?' : " AND (scope = ? OR scope = 'global')";
    params.push(normScope);
  }
  if (q && q.trim()) {
    sql += " AND content LIKE ? ESCAPE '\\'";
    params.push(`%${escapeSqlLike(q.trim())}%`);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(safeLimit);

  const stmt = db.prepare(sql);
  return queryAll(stmt, ...params);
}

// ==================== SEARCH SIGNALS FOR RECALL ====================

function searchMemoriesFTS5(userId, queryText, scope = 'global', limit = 10, { strictProjectScope = false } = {}) {
  const { validateScope, isProjectScope } = require('../types');
  const instance = initDatabase();
  const uid = userId || config.DEFAULT_USER_ID;
  const normScope = scope ? validateScope(scope) : 'global';
  const strict = Boolean((strictProjectScope || isProjectScope(normScope)) && normScope !== 'global');
  const cleanTokens = (queryText || '').replace(/[^\p{L}\p{N}_]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 10);
  if (cleanTokens.length === 0) return [];

  if (instance.mode === 'memory') {
    const list = Array.from(memStore.memories.values()).filter(m => {
      const isOwner = isRecordOwnedBy(m, uid);
      const isActive = m.isActive !== undefined ? m.isActive : m.is_active;
      const ms = validateScope(m.scope || 'global');
      const isScope = strict ? (ms === normScope) : (ms === normScope || ms === 'global');
      if (!isOwner || !isActive || !isScope) return false;
      const c = (m.content || '').toLowerCase();
      return cleanTokens.some(tok => c.includes(tok.toLowerCase()));
    }).map(normalizeMemoryRow);
    return list.slice(0, limit);
  }

  const { db } = instance;
  const ftsMatch = cleanTokens.map(w => `"${w}"*`).join(' OR ');
  const scopeClause = strict ? 'm.scope = ?' : "(m.scope = ? OR m.scope = 'global')";
  const likeScopeClause = strict ? 'scope = ?' : "(scope = ? OR scope = 'global')";

  try {
    const stmt = db.prepare(`
      SELECT m.*, fts.rank as bm25_rank
      FROM memories_fts fts
      JOIN memories m ON m.id = fts.memory_id
      WHERE fts.memories_fts MATCH ? 
        AND m.user_id = ?
        AND m.is_active = 1
        AND ${scopeClause}
      ORDER BY fts.rank ASC
      LIMIT ?
    `);
    return queryAll(stmt, ftsMatch, uid, normScope, limit);
  } catch (_) {
    // Fallback LIKE search if FTS5 table is disabled
    const stmt = db.prepare(`
      SELECT * FROM memories 
      WHERE user_id = ? AND is_active = 1 AND ${likeScopeClause}
        AND (${cleanTokens.map(() => "content LIKE ? ESCAPE '\\'").join(' OR ')})
      ORDER BY created_at DESC LIMIT ?
    `);
    const likeParams = cleanTokens.map(w => `%${escapeSqlLike(w)}%`);
    return queryAll(stmt, uid, normScope, ...likeParams, limit);
  }
}

function searchMemoriesVector(userId, queryVec, scope = 'global', limit = 10, { strictProjectScope = false } = {}) {
  const { validateScope, isProjectScope } = require('../types');
  const instance = initDatabase();
  const uid = userId || config.DEFAULT_USER_ID;
  const normScope = scope ? validateScope(scope) : 'global';
  const strict = Boolean((strictProjectScope || isProjectScope(normScope)) && normScope !== 'global');

  if (instance.mode === 'memory') {
    const rows = Array.from(memStore.memories.values()).filter(m => {
      const isOwner = isRecordOwnedBy(m, uid);
      const isActive = m.isActive !== undefined ? m.isActive : m.is_active;
      const ms = validateScope(m.scope || 'global');
      const isScope = strict ? (ms === normScope) : (ms === normScope || ms === 'global');
      return isOwner && isActive && isScope;
    }).map(normalizeMemoryRow);

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
  const scopeClause = strict ? 'scope = ?' : "(scope = ? OR scope = 'global')";
  const stmt = db.prepare(`
    SELECT * FROM memories 
    WHERE user_id = ? AND is_active = 1 AND ${scopeClause}
    ORDER BY updated_at DESC
    LIMIT 1000
  `);
  const rows = queryAll(stmt, uid, normScope);
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

function getExportSnapshot(userId) {
  const instance = initDatabase();
  const uid = userId || config.DEFAULT_USER_ID;

  if (instance.mode === 'memory' || !instance.db) {
    const memories = Array.from(memStore.memories.values())
      .filter(m => isRecordOwnedBy(m, uid) && (m.is_active === undefined || m.is_active === 1 || m.is_active === true))
      .map(normalizeMemoryRow)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const entities = Array.from(memStore.entities.values())
      .filter(e => isRecordOwnedBy(e, uid))
      .map(e => ({
        ...e,
        user_id: e.user_id || e.userId || uid,
        entity_type: e.entity_type || e.entityType || 'concept',
        updated_at: e.updated_at || e.updatedAt || ''
      }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    const relations = Array.from(memStore.relations.values())
      .filter(r => isRecordOwnedBy(r, uid))
      .map(r => ({
        ...r,
        user_id: r.user_id || r.userId || uid,
        source_entity_id: r.source_entity_id || r.sourceEntityId || '',
        target_entity_id: r.target_entity_id || r.targetEntityId || '',
        relation_type: r.relation_type || r.relationType || 'relates_to',
        valid_from: r.valid_from || r.validFrom || '',
        valid_until: r.valid_until !== undefined ? r.valid_until : (r.validUntil ?? null),
        episode_id: r.episode_id !== undefined ? r.episode_id : (r.episodeId ?? null)
      }))
      .sort((a, b) => new Date(a.valid_from) - new Date(b.valid_from));
    const episodes = Array.from(memStore.episodes.values())
      .filter(ep => isRecordOwnedBy(ep, uid))
      .map(ep => ({
        ...ep,
        user_id: ep.user_id || ep.userId || uid,
        session_id: ep.session_id || ep.sessionId || 'default',
        source_type: ep.source_type || ep.sourceType || 'chat',
        source_title: ep.source_title || ep.sourceTitle || '',
        source_uri: ep.source_uri || ep.sourceUri || '',
        raw_snippet: ep.raw_snippet || ep.rawSnippet || '',
        created_at: ep.created_at || ep.createdAt || ''
      }))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return { memories, entities, relations, episodes };
  }

  const { db } = instance;
  return {
    memories: queryAll(db.prepare('SELECT * FROM memories WHERE user_id = ? AND is_active = 1 ORDER BY created_at ASC'), uid),
    entities: queryAll(db.prepare('SELECT * FROM entities WHERE user_id = ? ORDER BY name ASC'), uid),
    relations: queryAll(db.prepare('SELECT * FROM relations WHERE user_id = ? ORDER BY valid_from ASC'), uid),
    episodes: queryAll(db.prepare('SELECT * FROM episodes WHERE user_id = ? ORDER BY created_at ASC'), uid)
  };
}

function getInsightsData(userId, scope = null) {
  const instance = initDatabase();
  const uid = userId || config.DEFAULT_USER_ID;

  if (instance.mode === 'memory' || !instance.db) {
    const entities = Array.from(memStore.entities.values())
      .filter(e => isRecordOwnedBy(e, uid) && (!scope || e.scope === scope || e.scope === 'global'))
      .map(e => ({
        ...e,
        entity_type: e.entity_type || e.entityType || 'concept',
        updated_at: e.updated_at || e.updatedAt || ''
      }))
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 30);

    const activeRelations = Array.from(memStore.relations.values())
      .filter(r => {
        if (!isRecordOwnedBy(r, uid) || (r.valid_until ?? r.validUntil)) return false;
        if (!scope) return true;
        const srcId = r.source_entity_id || r.sourceEntityId;
        const tgtId = r.target_entity_id || r.targetEntityId;
        const srcEnt = srcId ? memStore.entities.get(srcId) : null;
        const tgtEnt = tgtId ? memStore.entities.get(tgtId) : null;
        const srcMatch = !srcEnt || srcEnt.scope === scope || srcEnt.scope === 'global';
        const tgtMatch = !tgtEnt || tgtEnt.scope === scope || tgtEnt.scope === 'global';
        return srcMatch && tgtMatch;
      })
      .map(r => {
        const srcId = r.source_entity_id || r.sourceEntityId;
        const tgtId = r.target_entity_id || r.targetEntityId;
        const srcEnt = srcId ? memStore.entities.get(srcId) : null;
        const tgtEnt = tgtId ? memStore.entities.get(tgtId) : null;
        return {
          ...r,
          relation_type: r.relation_type || r.relationType || 'relates_to',
          valid_from: r.valid_from || r.validFrom || '',
          source_name: r.source_name || (srcEnt ? srcEnt.name : null),
          target_name: r.target_name || (tgtEnt ? tgtEnt.name : null)
        };
      })
      .sort((a, b) => new Date(b.valid_from) - new Date(a.valid_from))
      .slice(0, 20);

    return { entities, activeRelations };
  }

  const { db } = instance;
  let entSql = 'SELECT * FROM entities WHERE user_id = ?';
  const entParams = [uid];
  if (scope) {
    entSql += " AND (scope = ? OR scope = 'global')";
    entParams.push(scope);
  }
  entSql += ' ORDER BY updated_at DESC LIMIT 30';
  const entities = queryAll(db.prepare(entSql), ...entParams);

  let relSql = `
    SELECT r.*, e1.name as source_name, e2.name as target_name 
    FROM relations r
    LEFT JOIN entities e1 ON r.source_entity_id = e1.id
    LEFT JOIN entities e2 ON r.target_entity_id = e2.id
    WHERE r.user_id = ? AND r.valid_until IS NULL
  `;
  const relParams = [uid];
  if (scope) {
    const { validateScope, isProjectScope } = require('../types');
    const normScope = validateScope(scope);
    if (isProjectScope(normScope) && normScope !== 'global') {
      relSql += ' AND e1.scope = ? AND e2.scope = ?';
    } else {
      relSql += " AND (e1.scope = ? OR e1.scope = 'global') AND (e2.scope = ? OR e2.scope = 'global')";
    }
    relParams.push(normScope, normScope);
  }
  relSql += ' ORDER BY r.valid_from DESC LIMIT 20';
  const activeRelations = queryAll(db.prepare(relSql), ...relParams);
  return { entities, activeRelations };
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
  searchMemoriesVector,
  getExportSnapshot,
  getInsightsData
};
