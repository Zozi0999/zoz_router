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
  let category = metadata.category || 'preference';
  const lower = cleanContent.toLowerCase();
  if (!metadata.category) {
    if (cleanContent.startsWith('[KOREKSI KESALAHAN TERVERIFIKASI]')) {
      category = 'error_lesson';
    } else if (cleanContent.startsWith('[Episodik Sesi')) {
      category = 'episodic_context';
    } else if (/\b(?:menggunakan|stack|teknologi|bahasa|framework|database|tool|lib|library|runtime)\b/i.test(lower)) {
      category = 'technical_stack';
    } else if (/\b(?:proyek|project|fitur|target|roadmap|tujuan|aplikasi)\b/i.test(lower)) {
      category = 'project_context';
    } else if (/\b(?:instruksi|aturan|mandat|format|jangan|selalu)\b/i.test(lower)) {
      category = 'instruction';
    }
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
  sessionTitle = '',
  turnIndex = 0,
  userMessage = '',
  assistantResponse = '',
  scope = 'global',
  errorLesson = null,
  episodicSummary = null,
  preferenceMemory = null
}) {
  setImmediate(async () => {
    try {
      if (!userMessage || userMessage.trim().length < 2) return;

      // 0A. Simpan Pelajaran Koreksi Kesalahan Counterfactual (Error-Learning Memory: P(H_falsified) = 0)
      let resolvedErrorLesson = errorLesson;

      // Deteksi otomatis koreksi penjelasan silabus atau konfirmasi kunci jawaban resmi
      if (!resolvedErrorLesson && userMessage && assistantResponse) {
        const uStr = String(userMessage || '').trim();
        const aStr = String(assistantResponse || '').trim();

        // 1. Cek pengakuan jawaban resmi asisten
        const qnA = aStr.match(/Pertanyaan:\s*([^\n\r]+?)\s*Jawaban:\s*([^\n\r.]+)/i);
        if (qnA && qnA[1] && qnA[2]) {
          resolvedErrorLesson = {
            questionText: qnA[1].trim(),
            content: `[KOREKSI KESALAHAN TERVERIFIKASI] Soal: "${qnA[1].trim()}" | Hipotesis Salah (P = 0, JANGAN PILIH LAGI): Jawaban salah sebelumnya | Jawaban Terverifikasi: "${qnA[2].trim()}"`
          };
        } else {
          // 2. Cek kutipan penjelasan silabus resmi dari pengguna ("By using X and Y, Subject makes it...")
          const byUsingMatch = uStr.match(/\bBy using\s+([^,]+),\s*(\w+)\s+(?:makes|decreases|ensures|allows|protects)\b/i);
          if (byUsingMatch && byUsingMatch[1] && byUsingMatch[2]) {
            resolvedErrorLesson = {
              questionText: `Kasus ${byUsingMatch[2].trim()}: ${uStr.slice(0, 200)}`,
              content: `[KOREKSI KESALAHAN TERVERIFIKASI] Subjek: "${byUsingMatch[2].trim()}" | Konsep Terverifikasi Silabus: "${byUsingMatch[1].trim()}" | Penjelasan: "${uStr.slice(0, 260)}"`
            };
          }
        }
      }

      if (!resolvedErrorLesson && userMessage.includes('[PROYEKSI RUANG KEADAAN REVISI') && assistantResponse && assistantResponse.trim().length >= 2) {
        const qMatch = userMessage.match(/Konteks Pertanyaan Asli:\n([\s\S]*?)\n\nHipotesis yang TELAH TERFALSIFIKASI/i);
        const fMatch = userMessage.match(/Hipotesis yang TELAH TERFALSIFIKASI[^:]*:\n([\s\S]*?)\n\n/i);
        const qSnippet = qMatch && qMatch[1] ? qMatch[1].replace(/\s+/g, ' ').trim().slice(0, 260) : userMessage.replace(/\s+/g, ' ').trim().slice(0, 220);
        const fSnippet = fMatch && fMatch[1] ? fMatch[1].replace(/\s+/g, ' ').trim().slice(0, 220) : 'Jawaban sebelumnya';
        const vSnippet = assistantResponse.replace(/\s+/g, ' ').trim().slice(0, 260);
        resolvedErrorLesson = {
          questionText: qSnippet,
          content: `[KOREKSI KESALAHAN TERVERIFIKASI] Soal: "${qSnippet}" | Hipotesis Salah (P = 0, JANGAN PILIH LAGI): ${fSnippet} | Jawaban Terverifikasi: "${vSnippet}"`
        };
      }
      if (resolvedErrorLesson && resolvedErrorLesson.content) {
        const sanitizedLesson = sanitizeFactCandidate(resolvedErrorLesson.content);
        if (sanitizedLesson.accepted) {
          const epLesson = dbStorage.insertEpisode({
            userId,
            sessionId,
            turnIndex,
            sourceType: 'chat_error_correction',
            sourceTitle: `Koreksi Kesalahan Sesi: ${(resolvedErrorLesson.questionText || sessionTitle || sessionId).slice(0, 42)}`,
            sourceUri: `/chat/${sessionId}`,
            rawSnippet: resolvedErrorLesson.content.slice(0, 800)
          });
          const existingLessons = dbStorage.listMemories(userId, { category: 'error_lesson', limit: 40 });
          const qProbe = (resolvedErrorLesson.questionText || '').toLowerCase().slice(0, 90);
          const dupLesson = qProbe.length >= 15
            ? existingLessons.find(m => (m.content || '').toLowerCase().includes(qProbe))
            : null;
          if (dupLesson) {
            dbStorage.updateMemory(dupLesson.id, { content: sanitizedLesson.content, category: 'error_lesson', scope });
          } else {
            dbStorage.insertMemory({
              userId,
              content: sanitizedLesson.content,
              category: 'error_lesson',
              scope,
              confidence: 0.99,
              episodeId: epLesson.id
            });
          }
        }
      }

      // 0B. Simpan Preferensi Format Jawaban bila dikirim
      if (preferenceMemory && preferenceMemory.content) {
        const sanitizedPref = sanitizeFactCandidate(preferenceMemory.content);
        if (sanitizedPref.accepted) {
          const existingPrefs = dbStorage.listMemories(userId, { category: 'preference', limit: 25 });
          const dupPref = existingPrefs.find(m => (m.content || '').toLowerCase() === sanitizedPref.content.toLowerCase());
          if (!dupPref) {
            const epPref = dbStorage.insertEpisode({
              userId,
              sessionId,
              turnIndex,
              sourceType: 'chat_preference',
              sourceTitle: `Preferensi Format Chat`,
              sourceUri: `/chat/${sessionId}`,
              rawSnippet: sanitizedPref.content
            });
            dbStorage.insertMemory({
              userId,
              content: sanitizedPref.content,
              category: 'preference',
              scope,
              confidence: 0.95,
              episodeId: epPref.id
            });
          }
        }
      }

      // 0C. Simpan Ringkasan Episodik Lintas-Sesi (Q&A Distillation)
      let resolvedEpisodic = episodicSummary;
      if (!resolvedEpisodic && userMessage.trim().length >= 18 && assistantResponse && assistantResponse.trim().length >= 10) {
        const cleanQ = userMessage
          .replace(/\n*\[PROYEKSI (?:RUANG KEADAAN REVISI|OPERATOR ANAPHORA)[\s\S]*$/i, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleanQ.length >= 18 && !/^(?:halo|hai|pagi|siang|sore|malam|ok|oke|makasih|thanks|ping|tes)[\s!.?]*$/i.test(cleanQ)) {
          const cleanA = assistantResponse.replace(/\s+/g, ' ').trim().slice(0, 260);
          resolvedEpisodic = {
            questionSnippet: cleanQ.slice(0, 240),
            content: `[Episodik Sesi "${sessionTitle || 'Percakapan Sebelumnya'}"] Pertanyaan: ${cleanQ.slice(0, 240)} -> Jawaban/Kesimpulan: ${cleanA}`
          };
        }
      }
      if (resolvedEpisodic && resolvedEpisodic.content) {
        const sanitizedEp = sanitizeFactCandidate(resolvedEpisodic.content);
        if (sanitizedEp.accepted) {
          const existingEps = dbStorage.listMemories(userId, { category: 'episodic_context', limit: 40 });
          const qKey = (resolvedEpisodic.questionSnippet || '').toLowerCase().slice(0, 80);
          const dupEp = qKey.length >= 15
            ? existingEps.find(m => (m.content || '').toLowerCase().includes(qKey))
            : null;
          if (dupEp) {
            dbStorage.updateMemory(dupEp.id, { content: sanitizedEp.content, category: 'episodic_context', scope });
          } else {
            const epTrace = dbStorage.insertEpisode({
              userId,
              sessionId,
              turnIndex,
              sourceType: 'chat_episodic',
              sourceTitle: `Episodik Sesi: ${(sessionTitle || resolvedEpisodic.questionSnippet || sessionId).slice(0, 42)}`,
              sourceUri: `/chat/${sessionId}`,
              rawSnippet: sanitizedEp.content.slice(0, 600)
            });
            dbStorage.insertMemory({
              userId,
              content: sanitizedEp.content,
              category: 'episodic_context',
              scope,
              confidence: 0.90,
              episodeId: epTrace.id
            });
          }
        }
      }

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

      // Check if user stated facts about their environment, preferences, tech stack, rules, or entity relations
      const declarativeClues = /\b(?:saya\s+(?:menggunakan|suka|ingin|sedang|memakai|beralih|pindah|buat|bekerja|punya|seorang|adalah|bernama)|kami\s+(?:menggunakan|memakai)|aplikasi\s+(?:ini|kami)|proyek\s+(?:ini|kami)|aturan\s*:|wajib\s*:|preferensi\s*:|adalah|merupakan|ialah|yaitu|teman|sahabat|rekan|keluarga|saudara|kenalan|kolega|bos|atasan|bawahan|tokoh|pencipta|pembuat|nama\s+saya|pekerjaan\s+saya|tugas\s+anda)\b/i;
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
          confidence: 0.95,
          episodeId: ep.id
        });

        // Entity & Relational Graph Extraction (e.g. "Welin kusuma adalah teman zozi")
        const copulaRelationMatch = sent.match(/\b([a-zA-Z0-9_\-\s]{2,32})\s+(?:adalah|merupakan|ialah)\s+([a-zA-Z0-9_\-\s]{2,64})/i);
        if (copulaRelationMatch) {
          const subjName = copulaRelationMatch[1].trim();
          const objFact = copulaRelationMatch[2].trim();
          if (subjName.length >= 3 && objFact.length >= 3) {
            const entSubj = dbStorage.upsertEntity({ userId, name: subjName, entityType: 'person_or_subject', scope });
            const entObj = dbStorage.upsertEntity({ userId, name: objFact.split(/\s+/).slice(-2).join(' '), entityType: 'relation_target', scope });
            dbStorage.addRelation({
              userId,
              sourceEntityId: entSubj.id,
              targetEntityId: entObj.id,
              relationType: 'copula_definition',
              fact: cleanSent.content,
              episodeId: ep.id
            }, { resolveConflict: true });
          }
        }

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
