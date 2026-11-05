/**
 * Jozz Memory - Hybrid Extractor (Explicit Commands + Async Non-Blocking Background Worker)
 * Enforces Jozz Memory Architecture: Strict fact extraction, PII redaction & temporal relation updates
 */

const config = require('../config');
const dbStorage = require('../storage/db');
const { sanitizeFactCandidate } = require('./guardrails');

const ANAPHORIC_MEMORY_COMMAND_REGEX = /^(?:tolong\s+)?(?:catat(?:kan)?|simpan|ingat(?:kan)?|masukkan|rekam|tambahkan)\s*(?:itu|ini|hal\s+(?:itu|ini)|tadi|hal\s+tadi|informasi\s+(?:itu|ini|tadi)|poin\s+(?:itu|ini|tadi)|percakapan\s+ini|diskusi\s+ini)?\s*(?:ke\s+(?:dalam\s+)?memori|di\s+memori|ke\s+ingatan|ke\s+database)?[\s.!?]*$/i;
const INLINE_EXPLICIT_MEMORY_REGEX = /^(?:tolong\s+)?(?:ingat\s+bahwa|catat\s+bahwa|simpan\s+bahwa|perlu\s+diingat\s+bahwa|ingat(?:kan)?\s*:\s*|catat(?:kan)?\s*:\s*|simpan\s*:\s*|fakta\s*:\s*|preferensi\s*:\s*|catat\s+(?:itu|ini|hal\s+ini|hal\s+itu)?\s*ke\s+memori\s*(?:bahwa|yaitu|\:)?\s*|simpan\s+(?:itu|ini|hal\s+ini|hal\s+itu)?\s*ke\s+memori\s*(?:bahwa|yaitu|\:)?\s*|\/(?:remember|memori|ingat)\s+)(.+)$/i;
const EXPLICIT_MEMORY_REGEX = /^(?:tolong\s+)?(?:ingat(?:kan)?|simpan(?:\s+ke\s+memori)?|catat(?:kan)?|ingat\s+bahwa|perlu\s+diingat|preferensi\s+saya|catatan\s+penting|fakta\s+saya)[\s:,-]+(.+)$/i;
const SLASH_MEMORY_REGEX = /^\/(?:remember|memori|ingat)\s+(.+)$/i;

/**
 * Check if user message is an explicit memory command
 */
function parseExplicitMemoryDirective(userPrompt, previousContext = '') {
  if (!userPrompt || typeof userPrompt !== 'string') return null;
  const trimmed = userPrompt.trim();

  // 1. Cek anaphoric memory command ("Catat itu ke memori", "Simpan itu", dll.)
  if (ANAPHORIC_MEMORY_COMMAND_REGEX.test(trimmed)) {
    const prevText = typeof previousContext === 'string' ? previousContext.trim() : '';
    const hasContext = prevText.length >= 10;
    const content = hasContext ? prevText : '';
    return {
      isAnaphoric: true,
      content,
      hasContext,
      toString() { return this.content; }
    };
  }

  // 2. Cek inline memory command ("Ingat bahwa X", "Catat ke memori: X", "/remember X", dll.)
  const mInline = trimmed.match(INLINE_EXPLICIT_MEMORY_REGEX);
  if (mInline && mInline[1] && mInline[1].trim().length >= 3) {
    const content = mInline[1].trim();
    return {
      isAnaphoric: false,
      content,
      hasContext: true,
      toString() { return this.content; }
    };
  }

  // 3. Fallback pola slash command
  const mSlash = trimmed.match(SLASH_MEMORY_REGEX);
  if (mSlash && mSlash[1] && mSlash[1].trim().length >= 3) {
    const content = mSlash[1].trim();
    return {
      isAnaphoric: false,
      content,
      hasContext: true,
      toString() { return this.content; }
    };
  }

  // 4. Fallback pola teks reguler lama
  const mOld = trimmed.match(EXPLICIT_MEMORY_REGEX);
  if (mOld && mOld[1] && mOld[1].trim().length >= 4) {
    const content = mOld[1].trim();
    return {
      isAnaphoric: false,
      content,
      hasContext: true,
      toString() { return this.content; }
    };
  }

  return null;
}

/**
 * Process explicit memory capture
 */
function captureExplicitMemory(userId, factText, scope = 'global', metadata = {}) {
  const actualText = (factText && typeof factText === 'object' && factText.content) ? factText.content : String(factText || '');
  const sanitized = sanitizeFactCandidate(actualText);
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
    rawSnippet: actualText
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
      if (!userMessage || userMessage.trim().length < 3) return;

      // 1. Cek apakah ini perintah memori eksplisit / anaphora ("Catat itu ke memori", "Simpan ini", dsb.)
      const explicitDirective = parseExplicitMemoryDirective(userMessage, assistantResponse);
      if (explicitDirective && explicitDirective.hasContext && explicitDirective.content) {
        captureExplicitMemory(userId, explicitDirective.content.slice(0, 1500), scope, {
          sessionId,
          turnIndex,
          sourceType: 'chat',
          sourceTitle: `Instruksi Eksplisit Chat: ${userMessage.slice(0, 36)}`
        });
        return;
      }

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
