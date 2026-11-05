/**
 * Jozz Memory - Hybrid Extractor (Explicit Commands + Async Non-Blocking Background Worker)
 * Enforces Mistral AI standard: Strict fact extraction, PII redaction & temporal relation updates
 */

const config = require('../config');
const dbStorage = require('../storage/db');
const { sanitizeFactCandidate } = require('./guardrails');

const EXPLICIT_MEMORY_REGEX = /^(?:tolong\s+)?(?:ingat(?:kan)?|simpan(?:\s+ke\s+memori)?|catat(?:kan)?|ingat\s+bahwa|perlu\s+diingat|preferensi\s+saya|catatan\s+penting|fakta\s+saya)[\s:,-]+(.+)$/i;
const SLASH_MEMORY_REGEX = /^\/(?:remember|memori|ingat)\s+(.+)$/i;

/**
 * Check if user message is an explicit memory command
 */
function parseExplicitMemoryDirective(userPrompt) {
  if (!userPrompt || typeof userPrompt !== 'string') return null;
  const trimmed = userPrompt.trim();

  let matchedContent = null;
  const m1 = trimmed.match(SLASH_MEMORY_REGEX);
  if (m1) {
    matchedContent = m1[1].trim();
  } else {
    const m2 = trimmed.match(EXPLICIT_MEMORY_REGEX);
    if (m2) {
      matchedContent = m2[1].trim();
    }
  }

  if (!matchedContent || matchedContent.length < 4) return null;
  return matchedContent;
}

/**
 * Process explicit memory capture
 */
function captureExplicitMemory(userId, factText, scope = 'global', metadata = {}) {
  const sanitized = sanitizeFactCandidate(factText);
  if (!sanitized.accepted) {
    return { success: false, reason: sanitized.reason };
  }

  const cleanContent = sanitized.content;
  const ep = dbStorage.insertEpisode({
    userId,
    sessionId: metadata.sessionId || 'manual',
    turnIndex: metadata.turnIndex || 0,
    sourceType: metadata.sourceType || 'manual',
    sourceTitle: metadata.sourceTitle || 'Instruksi Pengguna Langsung',
    sourceUri: metadata.sourceUri || '',
    rawSnippet: factText
  });

  // Categorize
  let category = 'preference';
  const lower = cleanContent.toLowerCase();
  if (/\b(?:menggunakan|stack|teknologi|bahasa|framework|database|tool|lib|library|runtime)\b/i.test(lower)) {
    category = 'technical_stack';
  } else if (/\b(?:proyek|project|fitur|target|roadmap|tujuan|aplikasi)\b/i.test(lower)) {
    category = 'project_context';
  } else if (/\b(?:instruksi|aturan|mandat|format|jangan|selalu)\b/i.test(lower)) {
    category = 'instruction';
  }

  const memory = dbStorage.insertMemory({
    userId,
    content: cleanContent,
    category,
    scope: scope || config.DEFAULT_SCOPE,
    confidence: 1.0,
    episodeId: ep.id
  });

  // Extract simple entity & temporal relation if applicable
  const words = cleanContent.split(/\s+/).filter(w => w.length >= 3);
  if (words.length >= 2) {
    const entSubject = dbStorage.upsertEntity({
      userId,
      name: words[0],
      entityType: 'concept',
      summary: cleanContent,
      scope
    });
    const entTarget = dbStorage.upsertEntity({
      userId,
      name: words[words.length - 1],
      entityType: 'attribute',
      summary: cleanContent,
      scope
    });

    dbStorage.addRelation({
      userId,
      sourceEntityId: entSubject.id,
      targetEntityId: entTarget.id,
      relationType: category,
      fact: cleanContent,
      episodeId: ep.id
    }, { resolveConflict: true });
  }

  return {
    success: true,
    memory,
    episode: ep
  };
}

/**
 * Background async distillation: runs via setImmediate() after response stream finishes.
 * Non-blocking: will never slow down chat streaming.
 */
function triggerAsyncBackgroundExtraction({
  userId = 'default',
  sessionId = 'default',
  turnIndex = 0,
  userMessage = '',
  assistantResponse = '',
  scope = 'global'
}) {
  setImmediate(async () => {
    try {
      if (!userMessage || userMessage.length < 15) return;

      // Filter out greetings, short questions, and code pastes
      if (/^(?:halo|hai|pagi|siang|sore|malam|ok|oke|makasih|thanks|ping|tes)[\s!.?]*$/i.test(userMessage.trim())) {
        return;
      }

      // Check if user stated facts about their environment, preferences, tech stack, or rules
      const declarativeClues = /\b(?:saya\s+(?:menggunakan|suka|ingin|sedang|memakai|beralih|pindah|buat|bekerja|punya)|kami\s+(?:menggunakan|memakai)|aplikasi\s+(?:ini|kami)|proyek\s+(?:ini|kami)|aturan\s*:|wajib\s*:|preferensi\s*:)\b/i;
      const temporalReplacementClues = /\b(?:sekarang\s+menggunakan|beralih\s+ke|ganti\s+ke|tidak\s+lagi\s+memakai|pindah\s+dari\s+.*\s+ke)\b/i;

      if (!declarativeClues.test(userMessage) && !temporalReplacementClues.test(userMessage)) {
        return;
      }

      const candidateSnippet = userMessage.trim();
      const sanitized = sanitizeFactCandidate(candidateSnippet);
      if (!sanitized.accepted) return;

      // Create episode trace for receipts
      const ep = dbStorage.insertEpisode({
        userId,
        sessionId,
        turnIndex,
        sourceType: 'chat',
        sourceTitle: `Sesi Chat: ${candidateSnippet.slice(0, 32)}...`,
        sourceUri: `/chat/${sessionId}`,
        rawSnippet: candidateSnippet
      });

      // Distill sentences
      const sentences = candidateSnippet.split(/[.\n;]+/).map(s => s.trim()).filter(s => s.length >= 10);
      for (const sent of sentences) {
        if (!declarativeClues.test(sent) && !temporalReplacementClues.test(sent)) continue;
        const cleanSent = sanitizeFactCandidate(sent);
        if (!cleanSent.accepted) continue;

        let category = 'fact';
        if (/\b(?:menggunakan|memakai|stack|bahasa|framework|db|database)\b/i.test(sent)) {
          category = 'technical_stack';
        } else if (/\b(?:proyek|project|fitur|roadmap)\b/i.test(sent)) {
          category = 'project_context';
        } else if (/\b(?:suka|preferensi|lebih\s+memilih)\b/i.test(sent)) {
          category = 'preference';
        }

        // Save distilled memory item
        dbStorage.insertMemory({
          userId,
          content: cleanSent.content,
          category,
          scope,
          confidence: 0.92,
          episodeId: ep.id
        });

        // Temporal Relation Graph Resolution:
        // E.g. "Kami sekarang beralih dari REST ke GraphQL"
        if (temporalReplacementClues.test(sent)) {
          const matchSwitch = sent.match(/(?:dari|sebelumnya)\s+([a-zA-Z0-9_\-\.]+)\s+(?:ke|menjadi)\s+([a-zA-Z0-9_\-\.]+)/i);
          if (matchSwitch) {
            const oldTech = matchSwitch[1].trim();
            const newTech = matchSwitch[2].trim();

            const oldEnt = dbStorage.upsertEntity({ userId, name: oldTech, entityType: 'tech', scope });
            const newEnt = dbStorage.upsertEntity({ userId, name: newTech, entityType: 'tech', scope });

            // Mark old relation invalid & add new relation
            dbStorage.addRelation({
              userId,
              sourceEntityId: oldEnt.id,
              targetEntityId: newEnt.id,
              relationType: 'replaces',
              fact: cleanSent.content,
              episodeId: ep.id
            }, { resolveConflict: true });
          }
        }
      }
    } catch (err) {
      // Background worker failures MUST be silent and never crash or block chat
      console.warn('[Jozz Memory] Background extraction worker note:', err.message);
    }
  });
}

module.exports = {
  parseExplicitMemoryDirective,
  captureExplicitMemory,
  triggerAsyncBackgroundExtraction
};
