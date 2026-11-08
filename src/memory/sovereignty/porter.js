/**
 * Jozz Memory - Sovereignty Module (Export / Import in .json & .md)
 * Full data ownership, zero vendor lock-in, automatic deduplication.
 */

const config = require('../config');
const dbStorage = require('../storage/db');
const { sanitizeFactCandidate } = require('../pipeline/guardrails');

/**
 * Export user memories into JSON or Markdown
 */
function exportMemories(userId, format = 'json') {
  const uid = userId || config.DEFAULT_USER_ID;
  const { db } = dbStorage.initDatabase();

  const memStmt = db.prepare('SELECT * FROM memories WHERE user_id = ? ORDER BY created_at ASC');
  const memories = typeof memStmt.all === 'function' ? memStmt.all(uid) : [];

  const entStmt = db.prepare('SELECT * FROM entities WHERE user_id = ? ORDER BY name ASC');
  const entities = typeof entStmt.all === 'function' ? entStmt.all(uid) : [];

  const relStmt = db.prepare('SELECT * FROM relations WHERE user_id = ? ORDER BY valid_from ASC');
  const relations = typeof relStmt.all === 'function' ? relStmt.all(uid) : [];

  const epStmt = db.prepare('SELECT * FROM episodes WHERE user_id = ? ORDER BY created_at ASC');
  const episodes = typeof epStmt.all === 'function' ? epStmt.all(uid) : [];

  if (format === 'md' || format === 'markdown') {
    const lines = [
      '# JOZZ MEMORY EXPORT (SOVEREIGN KNOWLEDGE VAULT)',
      `*Generated on: ${new Date().toISOString()} | User: ${uid}*`,
      '',
      '---',
      '## 1. Daftar Memori Aktif (Distilled Memories)',
      ''
    ];

    const grouped = {};
    for (const m of memories) {
      const cat = m.category || 'general';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(m);
    }

    for (const [cat, items] of Object.entries(grouped)) {
      lines.push(`### Kategori: ${cat.toUpperCase()}`);
      for (const item of items) {
        lines.push(`- **[${item.id}]** ${item.content} *(Scope: ${item.scope || 'global'})*`);
      }
      lines.push('');
    }

    if (relations.length > 0) {
      lines.push('---');
      lines.push('## 2. Relasi Graf Pengetahuan Aktif (Temporal Knowledge Graph)');
      lines.push('');
      for (const r of relations) {
        const status = r.valid_until ? `[EXPIRED: ${r.valid_until}]` : '[ACTIVE]';
        lines.push(`- ${status} **(${r.relation_type})** ${r.fact} *(Sejak: ${r.valid_from})*`);
      }
      lines.push('');
    }

    return {
      contentType: 'text/markdown; charset=utf-8',
      fileName: `jozz_memories_${uid}_${Date.now()}.md`,
      content: lines.join('\n')
    };
  }

  // JSON export
  const exportPayload = {
    schemaVersion: '1.0',
    exportEngine: 'Jozz Memory Sovereign Engine',
    exportedAt: new Date().toISOString(),
    userId: uid,
    data: {
      memories,
      entities,
      relations,
      episodes
    }
  };

  return {
    contentType: 'application/json; charset=utf-8',
    fileName: `jozz_memories_${uid}_${Date.now()}.json`,
    content: JSON.stringify(exportPayload, null, 2)
  };
}

/**
 * Import memories from JSON string or Markdown string with deduplication
 */
function importMemories(userId, rawContent, format = 'json') {
  const uid = userId || config.DEFAULT_USER_ID;
  if (!rawContent || typeof rawContent !== 'string') {
    return { success: false, imported: 0, skipped: 0, reason: 'Konten kosong' };
  }

  let importedCount = 0;
  let skippedCount = 0;

  const existingMemories = dbStorage.listMemories(uid, { limit: 500 });
  const existingSet = new Set(existingMemories.map(m => m.content.toLowerCase().trim()));

  if (format === 'json') {
    let parsed = null;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      return { success: false, imported: 0, skipped: 0, reason: `Invalid JSON: ${e.message}` };
    }

    const items = Array.isArray(parsed.data?.memories) 
      ? parsed.data.memories 
      : (Array.isArray(parsed.memories) 
        ? parsed.memories 
        : (Array.isArray(parsed) ? parsed : []));
    for (const item of items) {
      const content = item.content || item.fact || item.text;
      if (!content) continue;

      const sanitized = sanitizeFactCandidate(content);
      if (!sanitized.accepted) {
        skippedCount++;
        continue;
      }

      const cleanKey = sanitized.content.toLowerCase().trim();
      if (existingSet.has(cleanKey)) {
        skippedCount++;
        continue;
      }

      existingSet.add(cleanKey);
      dbStorage.insertMemory({
        userId: uid,
        content: sanitized.content,
        category: item.category || 'general',
        scope: item.scope || 'global',
        confidence: item.confidence || 1.0
      });
      importedCount++;
    }
  } else {
    // Markdown parser (parses bullet points `- ...` or `* ...`)
    const lines = rawContent.split(/\r?\n/);
    let currentCategory = 'general';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('### Kategori:')) {
        currentCategory = trimmed.replace('### Kategori:', '').toLowerCase().trim();
        continue;
      }
      if (/^[-*]\s+/.test(trimmed)) {
        const rawItem = trimmed.replace(/^[-*]\s+/, '').replace(/^\*\*\[[^\]]+\]\*\*\s*/, '').replace(/\*\(Scope:[^)]+\)\*$/, '').trim();
        if (rawItem.length < 5) continue;

        const sanitized = sanitizeFactCandidate(rawItem);
        if (!sanitized.accepted) {
          skippedCount++;
          continue;
        }

        const cleanKey = sanitized.content.toLowerCase().trim();
        if (existingSet.has(cleanKey)) {
          skippedCount++;
          continue;
        }

        existingSet.add(cleanKey);
        dbStorage.insertMemory({
          userId: uid,
          content: sanitized.content,
          category: currentCategory,
          scope: 'global',
          confidence: 1.0
        });
        importedCount++;
      }
    }
  }

  return {
    success: true,
    imported: importedCount,
    skipped: skippedCount
  };
}

module.exports = {
  exportMemories,
  importMemories
};
