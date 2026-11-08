/**
 * Jozz Memory - Scoped Hybrid Recall Engine with Reciprocal Rank Fusion (RRF)
 * Integrates Vector Cosine Similarity + SQLite FTS5 BM25 + Temporal Graph Traversal
 */

const config = require('../config');
const dbStorage = require('../storage/db');
const { createMemoryReceipt } = require('../types');

const RETRIEVER_STOPWORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'adalah', 'untuk', 'pada', 'dengan', 'atau', 'dalam', 'tidak', 'bukan',
  'saya', 'aku', 'kamu', 'anda', 'kita', 'kami', 'mereka', 'dia', 'apa', 'siapa', 'dimana', 'kapan', 'mengapa', 'kenapa',
  'bagaimana', 'mana', 'saja', 'sja', 'aja', 'juga', 'sudah', 'telah', 'akan', 'bisa', 'dapat', 'harus', 'jika', 'kalau',
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day',
  'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let',
  'put', 'say', 'she', 'too', 'use', 'that', 'this', 'with', 'from', 'have', 'they', 'will', 'what', 'when', 'where',
  'which', 'following', 'statements', 'statement', 'about', 'correct', 'select', 'apply', 'above', 'below', 'true', 'false'
]);

function extractContentTokens(text) {
  if (!text || typeof text !== 'string') return [];
  return [...new Set(
    text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !RETRIEVER_STOPWORDS.has(w))
  )];
}

function computeTokenOverlapScore(queryTokens, docText) {
  if (!queryTokens.length || !docText) return 0;
  const docTokens = extractContentTokens(docText);
  if (!docTokens.length) return 0;
  const docSet = new Set(docTokens);
  let hit = 0;
  for (const t of queryTokens) {
    if (docSet.has(t)) hit++;
  }
  if (hit === 0) return 0;
  const dice = (2 * hit) / (queryTokens.length + docTokens.length);
  const containment = hit / Math.min(queryTokens.length, docTokens.length);
  return Math.max(dice, containment * 0.85);
}

const CROSS_SESSION_RECALL_QUERY_REGEX = /\b(?:percakapan\s+(?:kita\s+)?(?:sebelumnya|tadi|terakhir)|sesi\s+(?:kita\s+)?(?:sebelumnya|tadi|terakhir|lain)|pertanyaan\s+(?:kita\s+)?(?:sebelumnya|tadi|terakhir)|bahas(?:an)?\s+(?:kita\s+)?(?:sebelumnya|tadi|terakhir)|lanjutkan\s+(?:pembahasan|percakapan|yang)\s+(?:tadi|sebelumnya)|ingat\s+(?:percakapan|pertanyaan|pembahasan|soal)\s+(?:tadi|sebelumnya|kita))\b/i;

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

  // 4B. Counterfactual Error-Lesson Matching (High-Priority P(H_falsified) = 0 Signal)
  const queryTokens = extractContentTokens(q);
  const allRecent = dbStorage.listMemories(uid, { limit: 40 });
  if (queryTokens.length >= 2) {
    const errorLessons = allRecent.filter(m => m && (m.category === 'error_lesson' || String(m.content || '').startsWith('[KOREKSI KESALAHAN TERVERIFIKASI]')));
    errorLessons.forEach((lesson) => {
      const sim = computeTokenOverlapScore(queryTokens, lesson.content || '');
      if (sim >= 0.42) {
        addRank({ ...lesson, category: 'error_lesson' }, 1, 2.5 + sim, 'error_lesson');
      }
    });
  }

  // 4C. Cross-Session Episodic Recall Signal (Explicit Meta-Recall or High Token Overlap)
  const isExplicitCrossSessionRecall = CROSS_SESSION_RECALL_QUERY_REGEX.test(q);
  const recentEpisodic = allRecent.filter(m => m && (m.category === 'episodic_context' || String(m.content || '').startsWith('[Episodik Sesi')));
  recentEpisodic.forEach((epMem, idx) => {
    const sim = computeTokenOverlapScore(queryTokens, epMem.content || '');
    if (isExplicitCrossSessionRecall && idx < 4) {
      addRank({ ...epMem, category: 'episodic_context' }, idx + 1, 1.8, 'episodic_recent');
    } else if (sim >= 0.38) {
      addRank({ ...epMem, category: 'episodic_context' }, idx + 1, 1.4 * sim, 'episodic_match');
    }
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
    const errorLessonsList = injectList.filter(m => m.category === 'error_lesson' || String(m.content || '').startsWith('[KOREKSI KESALAHAN TERVERIFIKASI]'));
    const standardList = injectList.filter(m => !(m.category === 'error_lesson' || String(m.content || '').startsWith('[KOREKSI KESALAHAN TERVERIFIKASI]')));
    const blocks = [];

    if (errorLessonsList.length > 0) {
      const errLines = errorLessonsList.map(m => `- ${m.content}`);
      blocks.push(`[MEMORI KOREKSI KESALAHAN LINTAS-SESI (P(H_falsified) = 0)]:\n${errLines.join('\n')}\n(Falsifikasi di atas bersifat mengikat secara matematis: tetapkan P(H_falsified) = 0 agar kesalahan dari sesi sebelumnya tidak pernah terulang, dan gunakan jawaban terverifikasi yang tercatat).`);
    }

    if (standardList.length > 0) {
      const lines = standardList.map(m => {
        const epId = m.episode_id ? `Episode: ${m.episode_id}` : 'Manual';
        return `[MEM-${m.id.slice(-6)} | ${epId} | Kategori: ${m.category || 'fact'}]: ${m.content}`;
      });
      blocks.push(`### JOZZ MEMORY CONTEXT (CLICKABLE RECEIPTS ACTIVE):\n[INFORMASI MEMORI & RIWAYAT LINTAS-SESI TERVERIFIKASI]:\n${lines.join('\n')}\n(Gunakan fakta dan riwayat percakapan lintas-sesi di atas secara langsung dan akurat).`);
    }

    systemPromptInjection = blocks.join('\n\n');
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
