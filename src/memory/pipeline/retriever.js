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
      .replace(/[^\p{L}\p{N}\s_]/gu, ' ')
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

const CROSS_SESSION_RECALL_QUERY_REGEX = /\b(?:percakapan\s+(?:kita\s+)?(?:sebelumnya|tadi|terakhir)|sesi\s+(?:kita\s+)?(?:sebelumnya|tadi|terakhir|lain)|pertanyaan\s+(?:kita\s+)?(?:sebelumnya|tadi|terakhir)|bahas(?:an)?\s+(?:kita\s+)?(?:sebelumnya|tadi|terakhir)|lanjutkan\s+(?:pembahasan|percakapan|yang)\s+(?:tadi|sebelumnya)|ingat\s*(?:percakapan|pertanyaan|pembahasan|soal|siapa|teman|tokoh|lagi)?|coba\s+ingat|ingat[- ]ingat|pikun|lupa|tokoh\s+siapa|siapa\s+tokoh|siapa\s+yang\s+(?:saya|pernah)|pernah\s+(?:saya|kita)\s+(?:bahas|cerita|bicarakan)|kemarin\s+(?:kan|kita)|sesi\s+lalu|riwayat\s+sebelumnya)\b/i;

function isPoisonedHallucinationText(txt) {
  return /(?:gemini\s*4\s*(?:neon|argon|carbon|hydrogen)|gpt-?6\b|claude\s*5\b|llama\s*5\b|the\s+great\s+reasoning\s+war)/i.test(String(txt || ''));
}

function isExternalNewsOrModelClaimMemory(mem) {
  if (!mem) return false;
  const cat = String(mem.category || '').toLowerCase();
  if (cat === 'error_lesson') return false;
  const content = String(mem.content || '');
  if (isPoisonedHallucinationText(content)) return true;
  if (cat === 'episodic_context' || /^\[Episodik Sesi\b/i.test(content)) return true;
  return /(?:berdasarkan\s+data\s+terbaru|baru\s+saja\s+merilis|perilisan\s+besar|model\s+ai\s+(?:yang\s+)?baru\s+rilis|rilis\s+.*\b202[5-9])/i.test(content);
}

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
  const rawMax = options.maxResults !== undefined ? Number(options.maxResults) : config.MAX_RECALL_RESULTS;
  const maxResults = Math.max(1, Math.min(100, Number.isFinite(rawMax) ? Math.floor(rawMax) : config.MAX_RECALL_RESULTS));
  const minLexicalSimilarity = (options.minSimilarity !== undefined && Number.isFinite(Number(options.minSimilarity)))
    ? Math.max(0, Math.min(1, Number(options.minSimilarity)))
    : (config.MIN_LEXICAL_SIMILARITY ?? 0.25);
  const { validateScope, isProjectScope } = require('../types');
  const normScope = validateScope(targetScope);
  const strictProjectScope = Boolean(
    options.strictProjectScope ||
    isProjectScope(targetScope) ||
    isProjectScope(normScope)
  );
  const effectiveStrict = Boolean(strictProjectScope && normScope !== 'global');
  const rawRrfK = options.rrfK !== undefined ? Number(options.rrfK) : config.RRF_K;
  const rrfK = Math.max(1, Number.isFinite(rawRrfK) ? rawRrfK : config.RRF_K);

  // 1. Vector Signal
  const queryVec = dbStorage.computeFastEmbedding(q);
  const vectorHits = dbStorage.searchMemoriesVector(uid, queryVec, normScope, 24, { strictProjectScope: effectiveStrict });

  // 2. FTS5 BM25 Signal
  const ftsHits = dbStorage.searchMemoriesFTS5(uid, q, normScope, 24, { strictProjectScope: effectiveStrict });

  // 3. Graph Signal (Entity match -> Active Relation Traversal, supports punctuation & multi-word entities)
  const graphHits = [];
  const rawTokens = q.slice(0, 2000)
    .replace(/[^\p{L}\p{N}_-]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length >= 2)
    .slice(0, 40);
  const candidateNames = [];
  const seenCand = new Set();
  const pushCand = (s) => {
    const k = s.toLowerCase();
    if (k.length >= 3 && !seenCand.has(k)) {
      seenCand.add(k);
      candidateNames.push(s);
    }
  };
  for (let i = 0; i < rawTokens.length; i++) {
    pushCand(rawTokens[i]);
    if (i + 1 < rawTokens.length) pushCand(`${rawTokens[i]} ${rawTokens[i + 1]}`);
    if (i + 2 < rawTokens.length) pushCand(`${rawTokens[i]} ${rawTokens[i + 1]} ${rawTokens[i + 2]}`);
  }
  const matchedEntities = [];

  for (const cand of candidateNames) {
    const ent = dbStorage.findEntityByName(uid, cand, normScope, { strictProjectScope: effectiveStrict });
    if (ent && !matchedEntities.some(e => e.id === ent.id)) {
      matchedEntities.push(ent);
      const activeRelations = dbStorage.traverseActiveGraph(uid, ent.id, config.GRAPH_MAX_HOPS, normScope, { strictProjectScope: effectiveStrict });
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

  // Graph relations that point to memories or facts (hormati scope asli entitas sumber/tujuan)
  graphHits.forEach((rel, idx) => {
    const relSrcScope = rel.source_scope || rel.sourceScope || '';
    const relTgtScope = rel.target_scope || rel.targetScope || '';
    const inferredScope = (relSrcScope && relSrcScope !== 'global')
      ? relSrcScope
      : ((relTgtScope && relTgtScope !== 'global') ? relTgtScope : (relSrcScope || relTgtScope || 'global'));
    const syntheticItem = {
      id: `rel_${rel.id}`,
      user_id: uid,
      content: rel.fact,
      category: 'technical_stack',
      scope: inferredScope,
      confidence: 1.0,
      episode_id: rel.episode_id ?? rel.episodeId ?? null,
      is_active: 1
    };
    addRank(syntheticItem, idx + 1, config.WEIGHT_GRAPH, 'graph');
  });

  // 4B. Counterfactual Error-Lesson Matching (High-Priority P(H_falsified) = 0 Signal)
  const queryTokens = extractContentTokens(q);
  const allRecent = dbStorage.listMemories(uid, { scope: normScope, strictProjectScope: effectiveStrict, limit: 60 })
    .filter(m => m && m.is_active !== 0 && m.isActive !== 0 && m.is_active !== false);
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
  const suppressExternalEpisodic = Boolean(options && options.suppressExternalEpisodic) && !isExplicitCrossSessionRecall;
  if (!suppressExternalEpisodic) {
    const recentEpisodic = allRecent.filter(m => m && (m.category === 'episodic_context' || String(m.content || '').startsWith('[Episodik Sesi')));
    recentEpisodic.forEach((epMem, idx) => {
      if (isPoisonedHallucinationText(epMem.content)) return;
      const sim = computeTokenOverlapScore(queryTokens, epMem.content || '');
      if (isExplicitCrossSessionRecall && idx < 12) {
        const recencyWeight = 2.4 * Math.exp(-0.05 * idx);
        addRank({ ...epMem, category: 'episodic_context' }, idx + 1, recencyWeight, 'episodic_recent');
      } else if (sim >= 0.32) {
        addRank({ ...epMem, category: 'episodic_context' }, idx + 1, 1.6 * sim, 'episodic_match');
      }
    });
  }

  // 4D. Bayesian Core Fact Invariant Prior (Hanya injeksikan bila ada kecocokan semantik/leksikal nyata >= threshold)
  const coreMemories = allRecent.filter(m => m && (m.category === 'fact' || m.category === 'preference' || m.category === 'project_context'));
  coreMemories.forEach((coreMem, idx) => {
    const sim = computeTokenOverlapScore(queryTokens, coreMem.content || '');
    if (!isExplicitCrossSessionRecall && sim < minLexicalSimilarity) return;
    const priorWeight = isExplicitCrossSessionRecall ? 1.8 : (0.8 + sim * 2.0);
    addRank({ ...coreMem }, idx + 1, priorWeight, 'core_fact');
  });

  // Sort by combined RRF score descending (drop poisoned claims, zero-overlap noise, & enforce strict project-scope isolation)
  const sorted = Array.from(rrfMap.values())
    .filter(entry => {
      if (!entry || !entry.item || entry.score < config.MIN_RELEVANCE_SCORE) return false;
      if (isPoisonedHallucinationText(entry.item.content)) return false;
      if (suppressExternalEpisodic && isExternalNewsOrModelClaimMemory(entry.item)) return false;
      const lexSim = computeTokenOverlapScore(queryTokens, entry.item.content || '');
      const hasErrorLessonSignal = entry.signals.has('error_lesson');
      const requiredLexMin = entry.signals.has('graph') ? Math.min(minLexicalSimilarity, 0.2) : minLexicalSimilarity;
      if (!isExplicitCrossSessionRecall && !hasErrorLessonSignal && lexSim < requiredLexMin) {
        return false;
      }
      if (effectiveStrict && normScope && normScope !== 'global') {
        const itemScope = validateScope(entry.item.scope || 'global');
        const isMatchedPref = entry.item.category === 'preference' && lexSim >= Math.max(0.35, minLexicalSimilarity);
        if (itemScope !== normScope && !isMatchedPref) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  const memories = [];
  const receipts = [];

  for (const entry of sorted) {
    const m = entry.item;
    memories.push(m);

    // Resolve episode receipt
    let ep = null;
    const epId = m.episode_id || m.episodeId;
    if (epId) {
      ep = dbStorage.getEpisodeById(epId, uid);
    }

    const primarySignal = Array.from(entry.signals).join('+');
    receipts.push(createMemoryReceipt({
      memoryId: m.id,
      episodeId: epId || 'manual',
      sourceTitle: ep ? (ep.source_title || ep.sourceTitle || 'Sesi Chat') : (m.scope === 'global' ? 'Preferensi Global' : `Konteks ${m.scope}`),
      sourceUri: ep ? (ep.source_uri || ep.sourceUri || '') : '',
      sourceType: ep ? (ep.source_type || ep.sourceType || 'manual') : 'manual',
      rawSnippet: ep ? (ep.raw_snippet || ep.rawSnippet || m.content) : m.content,
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
        const mEpId = m.episode_id || m.episodeId;
        const epId = mEpId ? `Episode: ${mEpId}` : 'Manual';
        return `[MEM-${m.id.slice(-6)} | ${epId} | Kategori: ${m.category || 'fact'}]: ${m.content}`;
      });
      blocks.push(`### KONTEKS MEMORI PRIBADI PENGGUNA (Jozz Memory — HANYA Profil, Preferensi, & Proyek):\n${lines.join('\n')}\n[BATASAN EPISTEMIK WAJIB]: Catatan di atas HANYA untuk konteks pribadi/preferensi/proyek pengguna dan BUKAN sumber berita, rilis model AI, harga, atau fakta dunia nyata terkini. DILARANG memakai memori atau riwayat obrolan lama sebagai pengganti tool \`search_web\`.`);
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
