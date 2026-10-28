(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ZozTextSafety = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const REASONING_KEYS = new Set([
    'reasoning', 'reasoning_content', 'reasoning_details', 'thought', 'thinking', 'thoughts'
  ]);

  const THINKING_TAG_REGEX = /<(?:think|thought|thinking|reasoning|ant_thought|thought_process)\b[^>]*>[\s\S]*?(?:<\/(?:think|thought|thinking|reasoning|ant_thought|thought_process)>|$)/gi;
  const BRACKET_THINK_REGEX = /\[(?:THOUGHT|REASONING)\][\s\S]*?(?:\[\/(?:THOUGHT|REASONING)\]|$)/gi;
  const MODEL_TAG_REGEX = /\[(?:Model Penjawab|Model|AI Model|Konteks Percakapan|Konteks Silsilah|Konteks Internal|Catatan Konteks|AUTONOMIC NERVOUS LOG|BIO-ENDOCRINE|ChatEndocrine):[^\]]*\]\s*/gi;

  // ==================== PURE MATHEMATICAL TOKEN TRANSPORT & NON-EUCLIDEAN ENGINE ====================
  // Beroperasi murni pada lapisan Byte-Stream, Ruang Hilbert, & Manifold Poincaré Disk (K = -1)
  // TANPA bergantung pada teks persona / instruksi prompt.

  const STOPWORDS_AND_VERBS = new Set([
    'yang', 'di', 'ke', 'dari', 'dan', 'atau', 'dengan', 'untuk', 'pada', 'adalah', 'ini', 'itu',
    'saya', 'aku', 'kamu', 'anda', 'kita', 'kami', 'mereka', 'dia', 'ia', 'nya', 'kan', 'lah',
    'tolong', 'coba', 'buatkan', 'buat', 'bikin', 'ubah', 'ganti', 'jelaskan', 'ceritakan',
    'analisis', 'analisa', 'berikan', 'kasih', 'tulis', 'tuliskan', 'apa', 'apakah', 'bagaimana',
    'mengapa', 'kenapa', 'siapa', 'dimana', 'kapan', 'berapa', 'seperti', 'agar', 'supaya',
    'dalam', 'secara', 'tentang', 'mengenai', 'oleh', 'sebagai', 'bisa', 'dapat', 'akan', 'sudah',
    'sedang', 'masih', 'lebih', 'paling', 'sangat', 'sekali', 'juga', 'hanya', 'saja', 'tidak',
    'bukan', 'belum', 'jangan', 'jika', 'kalau', 'bila', 'karena', 'sebab', 'jadi', 'maka',
    'the', 'a', 'an', 'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'about', 'as',
    'is', 'are', 'was', 'were', 'be', 'been', 'please', 'can', 'could', 'would', 'should', 'you',
    'make', 'create', 'explain', 'tell', 'write', 'give', 'show', 'how', 'what', 'why', 'who'
  ]);

  const LOW_ENTROPY_FILLERS = new Set([
    'tentu', 'saja', 'baik', 'baiklah', 'halo', 'hai', 'hi', 'hello', 'pasti', 'berikut',
    'ini', 'adalah', 'penjelasan', 'mengenai', 'tentang', 'sebagai', 'asisten', 'ai', 'model',
    'bahasa', 'senang', 'hati', 'membantu', 'pertanyaan', 'menarik', 'bagus', 'sekali', 'mari',
    'kita', 'bahas', 'ulasan', 'ringkasan', 'jawaban', 'untuk', 'anda', 'kamu', 'sure',
    'certainly', 'here', 'happy', 'help', 'great', 'question', 'let', 'us', 'discuss', 'of', 'course'
  ]);

  const CASUAL_GREETING_ONLY_REGEX = /^(?:\s*(?:halo+|hai+|hi+|hello+|hey+|p|ping|tes|test|selamat\s+(?:pagi|siang|sore|malam)|assalamu'?alaikum|permisi|bro|gan|kak|min|bos|apa\s+kabar|gimana\s+kabarnya|makasih|terima\s+kasih|thanks|thank\s+you|oke|ok|sip|mantap|keren)\s*[!?.~,]*)+$/i;

  // Klausa pengantar berentropi rendah (dapat muncul berurutan di awal respons)
  const SINGLE_PREAMBLE_SENTENCE_REGEX = /^(?:\s*(?:(?:halo|hai|hi|hello|selamat\s+(?:pagi|siang|sore|malam))[!,.:\s]+|(?:wah[,.\s]+)?(?:pertanyaan|permintaan|topik|ide)\s+yang\s+(?:sangat\s+)?(?:bagus|menarik|hebat|luar\s+biasa|keren|tepat|kritis)[^.!?\n]*[.!?\n]+|(?:tentu(?:\s+saja)?|baik(?:lah)?|pasti|oke|siap|dengan\s+senang\s+hati|sure|certainly|of\s+course|great|absolutely)[,!.\s]+(?:(?:saya\s+(?:akan|bisa|dapat)|mari\s+kita|berikut\s+(?:ini\s+)?(?:adalah\s+)?|here\s+(?:is|are)\s+|let's\s+|i\s+(?:will|can)\s+)[^\n:.!?]*[:.!?]+\s*)?|(?:berikut\s+(?:ini\s+)?(?:adalah\s+)?(?:penjelasan|analisis|jawaban|ulasan|ringkasan|pembahasan|rincian|uraian|kode|implementasi|daftar|langkah|rumus)[^\n:.!?]*[:.!?]+\s*)|(?:here\s+(?:is|are)\s+(?:the|an?|your)?\s*(?:explanation|analysis|answer|overview|summary|breakdown|code|implementation|guide|list|steps|formula)[^\n:.!?]*[:.!?]+\s*)|(?:sebagai\s+(?:asisten\s+ai|model\s+bahasa|ai)[^,\n]*,\s*saya\s+akan\s+[^\n:.!?]*[:.!?]+\s*)))+/i;

  const REFUSAL_DEFLECTION_REGEX = /^\s*(?:(?:maaf|mohon\s+maaf|sorry|i\s+apologize|i'm\s+sorry|unfortunately)[,.\s]+)?(?:sebagai\s+(?:ai|model\s+bahasa|asisten\s+virtual|kecerdasan\s+buatan)|as\s+an\s+(?:ai|artificial\s+intelligence|language\s+model|helpful\s+assistant)|saya\s+tidak\s+(?:bisa|dapat|memiliki\s+(?:akses|kemampuan|opini)|diizinkan)\s+(?:untuk\s+)?(?:memberikan|menjawab|membuat|menganalisis|menjelaskan|memenuhi)|i\s+(?:cannot|can't|am\s+unable\s+to|am\s+not\s+able\s+to)\s+(?:provide|fulfill|answer|generate|create|assist\s+with))/i;

  function extractIntentVector(userPrompt) {
    const raw = String(userPrompt || '').trim();
    const isCasualGreeting = !raw || (raw.length < 45 && CASUAL_GREETING_ONLY_REGEX.test(raw));
    const isCodeMode = /\b(?:html|css|javascript|website|web|landing\s*page|portofolio|kode|code|script|component|react|jsx)\b/i.test(raw) || /<<<ZOZ_FILE|<<<<<<< SEARCH/i.test(raw);

    let cleanUserText = raw;
    const userInstructionMatch = raw.match(/(?:Instruksi Pengguna(?: Terkini)?|Permintaan Pengguna|Arahan \/ Keinginan Kustomisasi dari Pengguna):\s*"([^"]+)"/i);
    if (userInstructionMatch) {
      cleanUserText = userInstructionMatch[1].trim();
    }

    const tokens = cleanUserText
      .toLowerCase()
      .replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2);

    const vector = new Map();
    const coreTerms = [];
    const seenCore = new Set();

    for (const w of tokens) {
      const isStop = STOPWORDS_AND_VERBS.has(w);
      const weight = isStop ? 0.12 : (Math.log(1 + w.length) * (w.length >= 5 ? 1.6 : 1.1));
      vector.set(w, (vector.get(w) || 0) + weight);
      if (!isStop && w.length >= 3 && !seenCore.has(w)) {
        seenCore.add(w);
        coreTerms.push(w);
      }
    }

    let normSq = 0;
    for (const val of vector.values()) normSq += val * val;
    const norm = Math.sqrt(normSq) || 1;

    return {
      raw: cleanUserText,
      isCasualGreeting,
      isCodeMode,
      vector,
      norm,
      coreTerms
    };
  }

  function computeStreamMetrics(streamText, intentObj) {
    const text = String(streamText || '').trim();
    if (!text) return { entropyDensity: 0, cosineSimilarity: 0, isRefusal: false, isPreamble: false };

    const isRefusal = !(intentObj && intentObj.isCasualGreeting) && REFUSAL_DEFLECTION_REGEX.test(text);
    const isPreamble = !(intentObj && intentObj.isCasualGreeting) && SINGLE_PREAMBLE_SENTENCE_REGEX.test(text);

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ')
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) {
      return { entropyDensity: 0, cosineSimilarity: isRefusal ? -1 : 0, isRefusal, isPreamble };
    }

    let totalSelfInfo = 0;
    const streamVec = new Map();

    for (const w of words) {
      let info;
      if (LOW_ENTROPY_FILLERS.has(w)) {
        info = 0.04;
      } else if (STOPWORDS_AND_VERBS.has(w)) {
        info = 0.20;
      } else {
        info = Math.log(1 + w.length) * (w.length >= 5 ? 1.5 : 1.0);
      }
      totalSelfInfo += info;
      streamVec.set(w, (streamVec.get(w) || 0) + info);
    }

    const entropyDensity = totalSelfInfo / words.length;

    let dotProduct = 0;
    let streamNormSq = 0;
    for (const [sw, sVal] of streamVec.entries()) {
      streamNormSq += sVal * sVal;
      if (intentObj && intentObj.vector) {
        if (intentObj.vector.has(sw)) {
          dotProduct += sVal * intentObj.vector.get(sw);
        } else if (sw.length >= 4) {
          const stem = sw.slice(0, 4);
          for (const [uw, uVal] of intentObj.vector.entries()) {
            if (uw.length >= 4 && uw.startsWith(stem)) {
              dotProduct += sVal * uVal * 0.85;
              break;
            }
          }
        }
      }
    }

    const streamNorm = Math.sqrt(streamNormSq) || 1;
    const intentNorm = (intentObj && intentObj.norm) || 1;
    const rawCosine = Math.min(1, dotProduct / (streamNorm * intentNorm));
    const cosineSimilarity = isRefusal ? -1.0 : rawCosine;

    return {
      entropyDensity,
      cosineSimilarity,
      isRefusal,
      isPreamble
    };
  }

  function synthesizeAutoregressivePrefill(userPrompt, options = {}) {
    const intent = typeof userPrompt === 'object' && userPrompt && userPrompt.coreTerms
      ? userPrompt
      : extractIntentVector(userPrompt);

    if (intent.isCasualGreeting) return '';

    const mode = options.mode || (intent.isCodeMode ? 'code' : 'chat');
    const titleTerms = intent.coreTerms.slice(0, 6).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const cleanSubject = titleTerms || 'Analisis Teknis';

    if (mode === 'code' || mode === 'rewrite') {
      const fileName = options.fileName || 'index.html';
      if (options.useZozHeader) {
        return `<<<ZOZ_FILE name="${fileName}" mime="text/html" lang="html">\n<!DOCTYPE html>\n<html lang="id">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${cleanSubject}</title>\n`;
      }
      return `<!DOCTYPE html>\n<html lang="id">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${cleanSubject}</title>\n`;
    }

    return `**${cleanSubject}**\n\n`;
  }

  function createHyperbolicManifold() {
    const PHI = (Math.sqrt(5) - 1) / 2;
    let lastPoint = { x: 0, y: 0, r: 0, theta: 0, geodesicDist: 0, busemann: 0 };
    let lastTheta = 0;
    let dyckDepth = 0;
    const history = [];
    const MAX_HISTORY = 64;

    function mobiusSub(u, v) {
      const uDotV = u.x * v.x + u.y * v.y;
      const vSq = v.x * v.x + v.y * v.y;
      const uSq = u.x * u.x + u.y * u.y;
      const denom = 1 - 2 * uDotV + uSq * vSq;
      if (Math.abs(denom) < 1e-12) return { x: 0, y: 0 };
      const numX = (1 - 2 * uDotV + vSq) * u.x - (1 - uSq) * v.x;
      const numY = (1 - 2 * uDotV + vSq) * u.y - (1 - uSq) * v.y;
      return { x: numX / denom, y: numY / denom };
    }

    function geodesicDistance(u, v) {
      const diff = mobiusSub(u, v);
      const norm = Math.min(0.999999, Math.sqrt(diff.x * diff.x + diff.y * diff.y));
      return Math.log((1 + norm) / (1 - norm));
    }

    function busemannValue(z, xiTheta) {
      const xiX = Math.cos(xiTheta);
      const xiY = Math.sin(xiTheta);
      const dx = 1 - (z.x * xiX + z.y * xiY);
      const dy = -(z.y * xiX - z.x * xiY);
      const numSq = dx * dx + dy * dy;
      const denom = Math.max(1e-9, 1 - (z.x * z.x + z.y * z.y));
      return Math.log(numSq / denom);
    }

    function mapToken(tokenStr) {
      const s = String(tokenStr || '');
      if (!s) return lastPoint;

      const opens = (s.match(/<[a-zA-Z][^/>]*>|[{\[(]/g) || []).length;
      const closes = (s.match(/<\/[a-zA-Z][^>]*>|[}\])]/g) || []).length;
      dyckDepth = Math.max(0, dyckDepth + opens - closes);

      const cleanW = s.trim().toLowerCase();
      const selfInfo = LOW_ENTROPY_FILLERS.has(cleanW) ? 0.05 : Math.log(1 + Math.min(20, s.length));

      const r = Math.tanh((0.32 * dyckDepth + 0.22 * selfInfo) / 2);

      let hash = 0;
      for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash) + s.charCodeAt(i);
        hash |= 0;
      }
      const seed = Math.abs(hash) % 997;
      lastTheta = (lastTheta + 2 * Math.PI * PHI * (seed / 997)) % (2 * Math.PI);

      const pt = {
        x: r * Math.cos(lastTheta),
        y: r * Math.sin(lastTheta),
        r,
        theta: lastTheta,
        dyckDepth,
        token: s
      };

      pt.geodesicDist = geodesicDistance(lastPoint, pt);
      pt.busemann = busemannValue(pt, lastTheta);

      history.push(pt);
      if (history.length > MAX_HISTORY) history.shift();
      lastPoint = pt;
      return pt;
    }

    function detectHorocycleTrap(windowSize = 8) {
      if (history.length < windowSize) return { trapped: false, busemannVariance: 1 };
      const win = history.slice(-windowSize);

      let meanBusemann = 0;
      for (const p of win) meanBusemann += p.busemann;
      meanBusemann /= win.length;

      let busemannVariance = 0;
      for (const p of win) {
        const d = p.busemann - meanBusemann;
        busemannVariance += d * d;
      }
      busemannVariance /= win.length;

      const joined = win.map(p => p.token).join('');
      const hasPeriodicOrbit = joined.length >= 18 && /(.{3,80})\1{2,}$/s.test(joined);

      const trapped = hasPeriodicOrbit || (busemannVariance < 1e-8 && win[0].token.length > 4 && win.every(p => p.token === win[0].token));
      return { trapped, busemannVariance, radius: lastPoint.r };
    }

    return {
      mapToken,
      detectHorocycleTrap,
      getState: () => ({ lastPoint, dyckDepth, historyLength: history.length })
    };
  }

  function createEntropyStreamGate(userPrompt, options = {}) {
    const intent = extractIntentVector(userPrompt);
    const manifold = createHyperbolicManifold();
    let gateOpen = intent.isCasualGreeting || Boolean(options.bypassPreambleStrip);
    let lookaheadBuffer = '';
    let strippedPreamble = '';
    let refusalDetected = false;
    let horocycleTrapped = false;
    let totalProcessedChars = 0;
    const MAX_GATE_HOLD_CHARS = options.maxHoldChars || 180;

    function consumePreamblePrefix() {
      if (!lookaheadBuffer) return;
      while (true) {
        const m = SINGLE_PREAMBLE_SENTENCE_REGEX.exec(lookaheadBuffer);
        if (m && m[0].length > 0) {
          strippedPreamble += m[0];
          lookaheadBuffer = lookaheadBuffer.slice(m[0].length);
        } else {
          break;
        }
      }
    }

    function push(chunkText, isFinal = false) {
      const str = String(chunkText || '');
      if (str) {
        totalProcessedChars += str.length;
        manifold.mapToken(str);
        const trapCheck = manifold.detectHorocycleTrap();
        if (trapCheck.trapped) {
          horocycleTrapped = true;
        }
      }

      if (gateOpen) {
        return str;
      }

      lookaheadBuffer += str;

      // 1. Deteksi Subruang Penolakan (Refusal Subspace: cos θ = -1)
      if (!intent.isCasualGreeting && lookaheadBuffer.length >= 18) {
        if (REFUSAL_DEFLECTION_REGEX.test(lookaheadBuffer.trim())) {
          refusalDetected = true;
          if (!isFinal && lookaheadBuffer.length < MAX_GATE_HOLD_CHARS) {
            return '';
          }
        }
      }

      // 2. Kupas klausa basa-basi yang sudah lengkap (berakhir dengan :, ., !, ?, atau \n)
      consumePreamblePrefix();

      if (!lookaheadBuffer.trim()) {
        if (isFinal) {
          gateOpen = true;
          return strippedPreamble;
        }
        return '';
      }

      // 3. Jika token yang tersisa adalah kode/markdown/substansi atau sudah melewati batas tunggu, buka katup!
      const trimmed = lookaheadBuffer.trimStart();
      const isDirectSubstance = /^(?:<!DOCTYPE|<html|<div|<<<ZOZ_FILE|<<<<<<< SEARCH|```|#|\*\*|1\.|- )/i.test(trimmed);
      const hasSentenceOrLineEnd = /[:\n.!?]/.test(lookaheadBuffer);
      const metrics = computeStreamMetrics(lookaheadBuffer, intent);

      const looksLikeIncompletePreamble = /^(?:halo|hai|hi|hello|selamat|wah|pertanyaan|permintaan|topik|ide|tentu|baik|pasti|oke|siap|dengan\s+senang|berikut|sebagai|maaf|mohon\s+maaf|sorry|i\s+apologize|unfortunately|saya\s+tidak|i\s+cannot|i\s+can't|i\s+am\s+unable|as\s+an\s+ai|sure|certainly|of\s+course|here\s+is)\b/i.test(trimmed);

      if (isDirectSubstance || (!looksLikeIncompletePreamble && lookaheadBuffer.length >= 36 && metrics.entropyDensity >= 0.45) || (hasSentenceOrLineEnd && !looksLikeIncompletePreamble && lookaheadBuffer.length >= 24) || lookaheadBuffer.length >= MAX_GATE_HOLD_CHARS || isFinal) {
        consumePreamblePrefix();
        let out = lookaheadBuffer.replace(/^\s+/, '');
        lookaheadBuffer = '';
        if (!out) return '';
        if (strippedPreamble && /^[a-z]/.test(out)) {
          out = out.charAt(0).toUpperCase() + out.slice(1);
        }
        gateOpen = true;
        return out;
      }

      return '';
    }

    function flush() {
      if (gateOpen && !lookaheadBuffer) return '';
      consumePreamblePrefix();
      let out = lookaheadBuffer.replace(/^\s+/, '');
      lookaheadBuffer = '';
      const alreadyOpen = gateOpen;
      gateOpen = true;
      if (strippedPreamble && /^[a-z]/.test(out)) {
        out = out.charAt(0).toUpperCase() + out.slice(1);
      }
      if (out) return out;
      return alreadyOpen ? '' : strippedPreamble;
    }

    return {
      push,
      flush,
      getDiagnostics: () => ({
        intentCore: intent.coreTerms,
        strippedPreamble,
        refusalDetected,
        horocycleTrapped,
        manifold: manifold.getState()
      })
    };
  }

  function stripReasoningText(rawText) {
    if (typeof rawText !== 'string' || !rawText) return '';
    return rawText
      .replace(THINKING_TAG_REGEX, '')
      .replace(BRACKET_THINK_REGEX, '')
      .replace(/<\/?(?:think|thought|thinking|reasoning|ant_thought|thought_process)\b[^>]*>/gi, '')
      .replace(/\[\/?(?:THOUGHT|REASONING)\]/gi, '')
      .replace(MODEL_TAG_REGEX, '')
      .trim();
  }

  function splitReasoningAndContent(rawText) {
    if (typeof rawText !== 'string' || !rawText) {
      return { reasoning: '', content: '', isThinking: false };
    }
    const cleanContent = stripReasoningText(rawText);
    return { reasoning: '', content: cleanContent, isThinking: false };
  }

  function reflowShreddedProse(text) {
    // Preserve authored formatting instead of broadly rewriting Markdown.
    return typeof text === 'string' ? text : '';
  }

  function createThinkTagStripper() {
    let inside = false;
    let pending = '';

    const OPEN_REGEX = /<(?:think|thought|thinking|reasoning|ant_thought|thought_process)\b[^>]*>|\[(?:thought|reasoning)\]/i;
    const CLOSE_REGEX = /<\/(?:think|thought|thinking|reasoning|ant_thought|thought_process)>|\[\/(?:thought|reasoning)\]/i;

    function push(text, final = false) {
      let input = pending + String(text || '');
      pending = '';
      let output = '';

      while (input.length > 0) {
        if (inside) {
          const closeMatch = CLOSE_REGEX.exec(input);
          if (!closeMatch) {
            const lastLt = Math.max(input.lastIndexOf('<'), input.lastIndexOf('['));
            if (!final && lastLt >= 0 && input.length - lastLt < 25) {
              pending = input.slice(lastLt);
            }
            break;
          }
          input = input.slice(closeMatch.index + closeMatch[0].length);
          inside = false;
          continue;
        }

        const openMatch = OPEN_REGEX.exec(input);
        if (!openMatch) {
          const lastLt = Math.max(input.lastIndexOf('<'), input.lastIndexOf('['));
          if (!final && lastLt >= 0 && input.length - lastLt < 20) {
            output += input.slice(0, lastLt);
            pending = input.slice(lastLt);
          } else {
            output += input;
          }
          break;
        }

        output += input.slice(0, openMatch.index);
        input = input.slice(openMatch.index + openMatch[0].length);
        inside = true;
      }

      if (final && !inside && pending) {
        output += pending;
        pending = '';
      }
      return output.replace(MODEL_TAG_REGEX, '');
    }

    return { push };
  }

  function sanitizeRecord(record, tagStrippers, entropyGate = null, isFinalRecord = false) {
    if (Array.isArray(record)) return record.map(item => sanitizeRecord(item, tagStrippers, entropyGate, isFinalRecord));
    if (!record || typeof record !== 'object') return record;
    const localFinal = Boolean(isFinalRecord || record.done === true || record.finish_reason);
    const out = {};
    for (const [key, value] of Object.entries(record)) {
      // Hapus kunci reasoning/thought agar pemikiran internal tidak bocor ke output klien/penyimpanan
      if (REASONING_KEYS.has(key.toLowerCase())) {
        continue;
      }
      if ((key === 'content' || key === 'response' || key === 'text') && typeof value === 'string') {
        const id = key + ':' + (record.index ?? record.id ?? record.model ?? 'default');
        if (!tagStrippers.has(id)) tagStrippers.set(id, createThinkTagStripper());
        let cleaned = tagStrippers.get(id).push(value, localFinal);
        if (entropyGate) {
          cleaned = localFinal
            ? (entropyGate.push(cleaned, true) + entropyGate.flush())
            : entropyGate.push(cleaned, false);
        }
        out[key] = cleaned;
      } else if ((key === 'content' || key === 'response') && Array.isArray(value)) {
        out[key] = value.map((part, index) => {
          if (part && typeof part === 'object' && typeof part.text === 'string') {
            const id = `part:${record.index ?? record.id ?? 'default'}:${index}`;
            if (!tagStrippers.has(id)) tagStrippers.set(id, createThinkTagStripper());
            let cleaned = tagStrippers.get(id).push(part.text, localFinal);
            if (entropyGate) {
              cleaned = localFinal
                ? (entropyGate.push(cleaned, true) + entropyGate.flush())
                : entropyGate.push(cleaned, false);
            }
            return { ...part, text: cleaned };
          }
          return sanitizeRecord(part, tagStrippers, entropyGate, localFinal);
        });
      } else if (value && typeof value === 'object') {
        out[key] = sanitizeRecord(value, tagStrippers, entropyGate, localFinal);
      } else {
        out[key] = value;
      }
    }
    // Jika record OpenRouter memiliki finish_reason pada choice tetapi delta.content tidak ada, flush sisa gate
    if (localFinal && entropyGate && out.delta && typeof out.delta === 'object' && typeof out.delta.content !== 'string') {
      const flushed = entropyGate.flush();
      if (flushed) out.delta.content = flushed;
    }
    return out;
  }

  function createProviderStreamFilter(provider, mode = 'stream', options = {}) {
    let buffer = '';
    const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
    const tagStrippers = new Map();
    const entropyGate = (options && options.userPrompt)
      ? createEntropyStreamGate(options.userPrompt, options)
      : null;

    const finishTagStrippers = () => {
      let tail = '';
      for (const stripper of tagStrippers.values()) tail += stripper.push('', true);
      tagStrippers.clear();
      if (entropyGate) {
        tail = entropyGate.push(tail, true) + entropyGate.flush();
      }
      return tail;
    };
    const isOpenRouter = provider === 'openrouter';
    const isJsonSequence = provider === 'ollama' && mode === 'stream';
    const outputQueue = [];

    function decodeChunk(chunk, final = false) {
      const isBuffer = typeof Buffer !== 'undefined' && Buffer.isBuffer(chunk);
      if (decoder && isBuffer) return decoder.decode(chunk, { stream: !final });
      if (isBuffer) return chunk.toString('utf8');
      if (final && decoder) return decoder.decode();
      return String(chunk || '');
    }

    function cleanJson(raw, isSse) {
      try {
        const parsed = JSON.parse(raw);
        const isFinalRec = Boolean(parsed && (parsed.done === true || (Array.isArray(parsed.choices) && parsed.choices.some(c => c && c.finish_reason))));
        const hadOllamaText = Boolean(parsed && parsed.message && typeof parsed.message.content === 'string' && parsed.message.content.length > 0);
        const hadOpenRouterText = Boolean(parsed && Array.isArray(parsed.choices) && parsed.choices.some(c => c && c.delta && typeof c.delta.content === 'string' && c.delta.content.length > 0));
        const clean = sanitizeRecord(parsed, tagStrippers, entropyGate, isFinalRec);
        if (!isFinalRec && entropyGate) {
          if (hadOllamaText && clean && clean.message && clean.message.content === '' && !clean.message.tool_calls && !clean.message.images) {
            return '';
          }
          if (hadOpenRouterText && clean && Array.isArray(clean.choices) && clean.choices.every(c => !c || !c.delta || (c.delta.content === '' && !c.delta.tool_calls && !c.delta.images))) {
            return '';
          }
        }
        return (isSse ? 'data: ' : '') + JSON.stringify(clean);
      } catch (_) {
        // Jangan buang frame jika parsing gagal, teruskan frame asli agar tidak memutus kata
        return (isSse ? 'data: ' : '') + raw;
      }
    }

    function processLine(line, eol) {
      const trimmed = line.trim();
      if (!trimmed) return eol;
      if (isOpenRouter) {
        if (/^(event:|id:|retry:|:)/.test(trimmed)) return line + eol;
        if (!trimmed.startsWith('data:')) return '';
        const payload = trimmed.replace(/^data:\s*/, '');
        if (payload === '[DONE]') {
          let prefixFrame = '';
          if (entropyGate) {
            const flushed = entropyGate.flush();
            if (flushed) {
              prefixFrame = 'data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: flushed } }] }) + eol;
            }
          }
          return prefixFrame + 'data: [DONE]' + eol;
        }
        const clean = cleanJson(payload, true);
        return clean ? clean + eol : '';
      }
      const clean = cleanJson(trimmed, false);
      return clean ? clean + eol : '';
    }

    function drainQueue() {
      const output = outputQueue.join('');
      outputQueue.length = 0;
      return output;
    }

    function push(chunk) {
      buffer += decodeChunk(chunk, false);
      if (mode === 'json') return '';
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      if (isJsonSequence) {
        for (const line of lines) {
          if (!line.trim()) continue;
          const clean = cleanJson(line.trim(), false);
          if (clean) outputQueue.push(clean + '\n');
        }
        return drainQueue();
      }
      return lines.map(line => processLine(line, '\n')).join('');
    }

    function end() {
      let output = decodeChunk(typeof Buffer !== 'undefined' ? Buffer.alloc(0) : '', true);
      if (mode === 'json') {
        if (buffer.trim()) output += cleanJson(buffer, false);
        buffer = '';
      } else if (isJsonSequence) {
        if (buffer.trim()) {
          const clean = cleanJson(buffer.trim(), false);
          if (clean) outputQueue.push(clean);
        }
        buffer = '';
        output += drainQueue();
      } else if (buffer.trim()) {
        output += processLine(buffer, '');
        buffer = '';
      }
      const leftover = finishTagStrippers();
      if (leftover && isJsonSequence) {
        output += JSON.stringify({ message: { role: 'assistant', content: leftover }, done: false }) + '\n';
      }
      return output;
    }

    return {
      push,
      end,
      getGateDiagnostics: () => (entropyGate ? entropyGate.getDiagnostics() : null)
    };
  }

  return {
    splitReasoningAndContent,
    stripReasoningText,
    reflowShreddedProse,
    createThinkTagStripper,
    createProviderStreamFilter,
    extractIntentVector,
    computeStreamMetrics,
    synthesizeAutoregressivePrefill,
    createHyperbolicManifold,
    createEntropyStreamGate
  };
});
