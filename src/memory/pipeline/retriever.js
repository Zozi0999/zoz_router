/**
 * Jozz Memory - Scoped Hybrid Recall Engine with Reciprocal Rank Fusion (RRF)
 * Integrates Vector Cosine Similarity + SQLite FTS5 BM25 + Temporal Graph Traversal
 */

const config = require('../config');
const dbStorage = require('../storage/db');
const { createMemoryReceipt } = require('../types');

/**
 * Perform Scoped Hybrid Recall combining:
 * 1. Vector Cosine Similarity (Float32Array)
 * 2. SQLite FTS5 BM25
 * 3. 1-2 Hop Temporal Knowledge Graph Traversal (valid_until IS NULL)
 */
function recallMemories(userId, queryText, scope = 'global', options = {}) {
  const uid = userId || config.DEFAULT_USER_ID;
  const q = String(queryText || '').trim();
  if (!q) return { memories: [], receipts: [], systemPromptInjection: '' };

  const targetScope = scope || config.DEFAULT_SCOPE;
  const maxResults = options.maxResults || config.MAX_RECALL_RESULTS;
  const rrfK = options.rrfK || config.RRF_K;

  // 1. Vector Signal
  const queryVec = dbStorage.computeFastEmbedding(q);
  const vectorHits = dbStorage.searchMemoriesVector(uid, queryVec, targetScope, 12);

  // 2. FTS5 BM25 Signal
  const ftsHits = dbStorage.searchMemoriesFTS5(uid, q, targetScope, 12);

  // 3. Graph Signal (Entity match -> Active Relation Traversal)
  const graphHits = [];
  const words = q.split(/\s+/).filter(w => w.length >= 3);
  const matchedEntities = [];

  for (const w of words) {
    const ent = dbStorage.findEntityByName(uid, w, targetScope);
    if (ent && !matchedEntities.some(e => e.id === ent.id)) {
      matchedEntities.push(ent);
      const activeRelations = dbStorage.traverseActiveGraph(uid, ent.id, config.GRAPH_MAX_HOPS);
      for (const rel of activeRelations) {
        if (!graphHits.some(g => g.id === rel.id)) {
          graphHits.push(rel);
        }
      }
    }
  }

  // 4. Reciprocal Rank Fusion (RRF) Scoring
  // Score(d) = sum( w_m / (k + rank_m(d)) )
  const rrfMap = new Map();

  // Helper to add rank
  const addRank = (item, rank, weight, signalName) => {
    const id = item.id;
    const rrfIncrement = weight / (rrfK + rank);
    if (!rrfMap.has(id)) {
      rrfMap.set(id, {
        item,
        score: 0.0,
        signals: new Set(),
        signalRanks: {}
      });
    }
    const entry = rrfMap.get(id);
    entry.score += rrfIncrement;
    entry.signals.add(signalName);
    entry.signalRanks[signalName] = rank;
  };

  vectorHits.forEach((item, idx) => {
    addRank(item, idx + 1, config.WEIGHT_VECTOR, 'vector');
  });

  ftsHits.forEach((item, idx) => {
    addRank(item, idx + 1, config.WEIGHT_BM25, 'bm25');
  });

  // Graph relations that point to memories or facts
  graphHits.forEach((rel, idx) => {
    // If relation has a fact, treat as virtual or linked memory
    const syntheticItem = {
      id: `rel_${rel.id}`,
      user_id: uid,
      content: rel.fact,
      category: 'technical_stack',
      scope: targetScope,
      confidence: 1.0,
      episode_id: rel.episode_id,
      is_active: 1
    };
    addRank(syntheticItem, idx + 1, config.WEIGHT_GRAPH, 'graph');
  });

  // Sort by combined RRF score descending
  const sorted = Array.from(rrfMap.values())
    .filter(entry => entry.score >= config.MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  const memories = [];
  const receipts = [];

  for (const entry of sorted) {
    const m = entry.item;
    memories.push(m);

    // Resolve episode receipt
    let ep = null;
    if (m.episode_id) {
      ep = dbStorage.getEpisodeById(m.episode_id);
    }

    const primarySignal = Array.from(entry.signals).join('+');
    receipts.push(createMemoryReceipt({
      memoryId: m.id,
      episodeId: m.episode_id || 'manual',
      sourceTitle: ep ? ep.source_title : (m.scope === 'global' ? 'Preferensi Global' : `Konteks ${m.scope}`),
      sourceUri: ep ? ep.source_uri : '',
      sourceType: ep ? ep.source_type : 'manual',
      rawSnippet: ep ? ep.raw_snippet : m.content,
      relevanceScore: entry.score,
      matchedSignal: primarySignal
    }));
  }

  // 5. Generate System Prompt Injection String
  let systemPromptInjection = '';
  if (memories.length > 0) {
    const injectList = memories.slice(0, config.MAX_SYSTEM_INJECT_MEMORIES);
    const lines = injectList.map(m => {
      const epId = m.episode_id ? `Episode: ${m.episode_id}` : 'Manual';
      return `[MEM-${m.id.slice(-6)} | ${epId} | Kategori: ${m.category || 'fact'}]: ${m.content}`;
    });

    systemPromptInjection = `### JOZZ MEMORY CONTEXT (CLICKABLE RECEIPTS ACTIVE):
[INFORMASI MEMORI TERVERIFIKASI PENGGUNA — INJEKSI RESMI]:
AI WAJIB mempertimbangkan preferensi, fakta terverifikasi, dan konteks proyek pengguna berikut secara konsisten:
${lines.join('\n')}
(Gunakan fakta di atas sebagai kebenaran langsung tanpa perlu menanyakannya kembali kepada pengguna).`;
  }

  return {
    memories,
    receipts,
    systemPromptInjection
  };
}

module.exports = {
  recallMemories
};
