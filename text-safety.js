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

  // ============================================================================
  // 2. TEORI GRAF BILANGAN ERDŐS (ERDŐS COLLABORATION DISTANCE GRAPH)
  // v_0 (Erdős = 0) : Kernel Niat Pengguna (User Intent Kernel)
  // v_1 (Erdős = 1) : Token/Baris yang berkolaborasi langsung (co-occurring) dengan v_0
  // v_2 (Erdős = 2) : Token jembatan struktural yang terhubung ke simpul Erdős = 1
  // v_∞ (Erdős > 2) : Simpul terisolasi / melenceng dari maksud pengguna
  // ============================================================================
  function computeErdosIntentGraph(userPrompt, candidateText = '', sourceCode = '') {
    const intent = extractIntentVector(userPrompt);
    const erdosZeroSet = new Set(intent.coreTerms.map(t => t.toLowerCase()));
    const erdosOneSet = new Set();
    const erdosTwoSet = new Set();

    // Bangun ketetanggaan Hop-1 dari klausa prompt dan baris sourceCode yang mengandung simpul Erdős-0
    const contextCorpus = [String(userPrompt || ''), String(sourceCode || ''), String(candidateText || '')].join('\n');
    const clauses = contextCorpus.split(/[\r\n.;!?]+/);

    for (const clause of clauses) {
      const words = clause.toLowerCase().replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ').split(/\s+/).filter(w => w.length >= 2 && !LOW_ENTROPY_FILLERS.has(w));
      const hasZero = words.some(w => erdosZeroSet.has(w) || [...erdosZeroSet].some(z => z.length >= 4 && (w.includes(z) || z.includes(w))));
      if (hasZero) {
        for (const w of words) {
          if (!erdosZeroSet.has(w)) erdosOneSet.add(w);
        }
      }
    }

    for (const clause of clauses) {
      const words = clause.toLowerCase().replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ').split(/\s+/).filter(w => w.length >= 2 && !LOW_ENTROPY_FILLERS.has(w));
      const hasOne = words.some(w => erdosOneSet.has(w));
      if (hasOne) {
        for (const w of words) {
          if (!erdosZeroSet.has(w) && !erdosOneSet.has(w)) erdosTwoSet.add(w);
        }
      }
    }

    // Evaluasi distribusi bilangan Erdős pada candidateText
    const evalWords = String(candidateText || '').toLowerCase().replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ').split(/\s+/).filter(w => w.length >= 2 && !LOW_ENTROPY_FILLERS.has(w));
    let sumDistance = 0;
    let hop0Count = 0;
    let hop1Count = 0;
    let hop2Count = 0;
    let disconnectedCount = 0;

    for (const w of evalWords) {
      if (erdosZeroSet.has(w) || [...erdosZeroSet].some(z => z.length >= 4 && (w.includes(z) || z.includes(w)))) {
        hop0Count++;
        sumDistance += 0;
      } else if (erdosOneSet.has(w)) {
        hop1Count++;
        sumDistance += 1;
      } else if (erdosTwoSet.has(w)) {
        hop2Count++;
        sumDistance += 2;
      } else {
        disconnectedCount++;
        sumDistance += 4; // penalti komponen tak terhubung
      }
    }

    const totalEval = Math.max(1, evalWords.length);
    const meanErdosNumber = evalWords.length > 0 ? (sumDistance / totalEval) : 1;
    const erdosAffinity = 1 / (1 + meanErdosNumber);
    const hop1Ratio = (hop0Count + hop1Count) / totalEval;

    // Cari baris jangkar pada sourceCode dengan Bilangan Erdős <= 1 (untuk lokalisasi target edit website)
    const hop1Anchors = [];
    if (sourceCode) {
      const srcLines = String(sourceCode).split(/\r?\n/);
      for (let i = 0; i < srcLines.length; i++) {
        const line = srcLines[i];
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 4) continue;
        const lWords = trimmed.toLowerCase().replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ').split(/\s+/).filter(Boolean);
        let hits0 = 0;
        let hits1 = 0;
        for (const lw of lWords) {
          if (erdosZeroSet.has(lw) || [...erdosZeroSet].some(z => z.length >= 4 && (lw.includes(z) || z.includes(lw)))) hits0++;
          else if (erdosOneSet.has(lw)) hits1++;
        }
        if (hits0 > 0) {
          hop1Anchors.push({ lineNumber: i + 1, erdosNumber: 1, score: hits0 * 3 + hits1, content: line });
        }
      }
      hop1Anchors.sort((a, b) => b.score - a.score);
    }

    return {
      erdosZeroKernel: [...erdosZeroSet],
      meanErdosNumber: Number(meanErdosNumber.toFixed(4)),
      erdosAffinity: Number(erdosAffinity.toFixed(4)),
      hop1Ratio: Number(hop1Ratio.toFixed(4)),
      counts: { hop0: hop0Count, hop1: hop1Count, hop2: hop2Count, disconnected: disconnectedCount },
      hop1Anchors: hop1Anchors.slice(0, 8)
    };
  }

  // ============================================================================
  // 3. TEOREMA BATAS SZEGŐ & MATRIKS TOEPLITZ (SZEGŐ TOEPLITZ SPECTRAL ANALYZER)
  // Memodelkan sinyal pengiriman token x_1..x_N sebagai matriks autokorelasi Toeplitz
  // T_p = [r_{|i-j|}] dan menghitung koefisien polinomial ortogonal Szegő / Verblunsky
  // κ_k serta rasio determinan asimtotik:
  //   lim_{p->∞} det(T_p) / (r_0 * det(T_{p-1})) = Π_{k=1}^p (1 - κ_k^2) = exp(1/2π ∫ ln(f(ω)/r_0) dω)
  // ============================================================================
  function computeSzegoToeplitzSpectrum(signalSamples, maxOrder = 6) {
    const x = Array.isArray(signalSamples) ? signalSamples.map(Number).filter(Number.isFinite) : [];
    const N = x.length;
    if (N < 3) {
      return {
        szegoSpectralFlatness: 1,
        toeplitzDetRatio: 1,
        verblunskyCoeffs: [],
        eigenMin: 1,
        eigenMax: 1,
        isNarrowbandSingularity: false
      };
    }

    let mean = 0;
    for (let i = 0; i < N; i++) mean += x[i];
    mean /= N;

    const centered = new Array(N);
    for (let i = 0; i < N; i++) centered[i] = x[i] - mean;

    const p = Math.min(maxOrder, N - 1);
    const r = new Array(p + 1).fill(0);
    for (let k = 0; k <= p; k++) {
      let acc = 0;
      for (let n = 0; n < N - k; n++) {
        acc += centered[n] * centered[n + k];
      }
      r[k] = acc / N;
    }

    if (r[0] <= 1e-12) {
      return {
        szegoSpectralFlatness: 0,
        toeplitzDetRatio: 0,
        verblunskyCoeffs: [1],
        eigenMin: 0,
        eigenMax: 0,
        isNarrowbandSingularity: N >= 6
      };
    }

    // Rekursi Levinson-Durbin untuk Polinomial Ortogonal Szegő pada Lingkaran Satuan (OPUC)
    const a = new Array(p + 1).fill(0);
    const verblunskyCoeffs = [];
    let E = r[0];
    let detProduct = 1.0;

    for (let k = 1; k <= p; k++) {
      let lambda = r[k];
      for (let j = 1; j < k; j++) {
        lambda += a[j] * r[k - j];
      }
      const kappa = Math.max(-0.9999, Math.min(0.9999, -lambda / Math.max(1e-12, E)));
      verblunskyCoeffs.push(Number(kappa.toFixed(4)));

      const nextA = new Array(p + 1).fill(0);
      nextA[k] = kappa;
      for (let j = 1; j < k; j++) {
        nextA[j] = a[j] + kappa * a[k - j];
      }
      for (let j = 1; j <= k; j++) a[j] = nextA[j];

      const factor = 1 - kappa * kappa;
      detProduct *= factor;
      E *= factor;
    }

    // Evaluasi simbol spektral Fourier f(ω) = r_0 + 2 Σ_{k=1}^p (1 - k/(p+1)) r_k cos(k ω) (kernel Fejér-Szegő non-negatif)
    let fMin = Infinity;
    let fMax = -Infinity;
    const M = 16;
    for (let m = 0; m < M; m++) {
      const omega = (Math.PI * m) / (M - 1);
      let fVal = r[0];
      for (let k = 1; k <= p; k++) {
        const fejerWeight = 1 - (k / (p + 1));
        fVal += 2 * fejerWeight * r[k] * Math.cos(k * omega);
      }
      if (fVal < fMin) fMin = fVal;
      if (fVal > fMax) fMax = fVal;
    }

    const szegoSpectralFlatness = Math.max(0, Math.min(1, detProduct));
    return {
      szegoSpectralFlatness: Number(szegoSpectralFlatness.toFixed(4)),
      toeplitzDetRatio: Number((E / r[0]).toFixed(4)),
      verblunskyCoeffs,
      eigenMin: Number(Math.max(0, fMin).toFixed(4)),
      eigenMax: Number(Math.max(0, fMax).toFixed(4)),
      isNarrowbandSingularity: N >= 8 && szegoSpectralFlatness < 0.015
    };
  }

  // ============================================================================
  // 4. TEOREMA KŐNIG (BIPARTITE MAXIMUM MATCHING = MINIMUM VERTEX COVER)
  // Mencocokkan blok SEARCH (himpunan simpul U) terhadap jendela baris kode sumber
  // (himpunan simpul V) pada graf bipartit G = (U ∪ V, E) menggunakan algoritma
  // lintasan penambah (augmenting path) Kőnig-Hopcroft-Karp sehingga pengeditan
  // website berhasil secara deterministik meskipun ada deviasi spasi/atribut kecil.
  // ============================================================================
  function normalizeCodeLineForKonig(line) {
    return String(line || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s*([=<>/{};:(),])\s*/g, '$1')
      .toLowerCase();
  }

  function computeLineBipartiteWeight(normU, normV) {
    if (!normU && !normV) return 1.0;
    if (!normU || !normV) return 0.0;
    if (normU === normV) return 1.0;
    if (normU.length < 3 || normV.length < 3) {
      return normU === normV ? 1.0 : 0.0;
    }
    // Sorensen-Dice bigram similarity pada string ternormalisasi
    const bigramsU = new Map();
    for (let i = 0; i < normU.length - 1; i++) {
      const bg = normU.slice(i, i + 2);
      bigramsU.set(bg, (bigramsU.get(bg) || 0) + 1);
    }
    let intersection = 0;
    for (let i = 0; i < normV.length - 1; i++) {
      const bg = normV.slice(i, i + 2);
      const count = bigramsU.get(bg) || 0;
      if (count > 0) {
        intersection++;
        bigramsU.set(bg, count - 1);
      }
    }
    return (2.0 * intersection) / ((normU.length - 1) + (normV.length - 1));
  }

  function konigBipartiteMatchHunk(sourceCode, searchStr, replaceStr, edgeThreshold = 0.72) {
    const code = String(sourceCode || '');
    const sRaw = String(searchStr || '').replace(/^\r?\n/, '').replace(/\r?\n\s*$/, '');
    const rRaw = String(replaceStr || '').replace(/^\r?\n/, '').replace(/\r?\n\s*$/, '');
    if (!code || !sRaw.trim()) return null;

    const srcLines = code.split(/\r?\n/);
    const rawSearchLines = sRaw.split(/\r?\n/);

    // Filter simpul U (baris non-kosong dari SEARCH) beserta indeks aslinya
    const U = [];
    for (let i = 0; i < rawSearchLines.length; i++) {
      const norm = normalizeCodeLineForKonig(rawSearchLines[i]);
      if (norm) U.push({ idx: i, raw: rawSearchLines[i], norm });
    }
    if (U.length === 0) return null;

    const normSrc = srcLines.map(normalizeCodeLineForKonig);

    // Cari kandidat posisi awal berdasarkan kecocokan simpul pertama U[0] atau simpul kedua U[1]
    const candidateStarts = new Set();
    for (let j = 0; j < normSrc.length; j++) {
      if (!normSrc[j]) continue;
      if (computeLineBipartiteWeight(U[0].norm, normSrc[j]) >= edgeThreshold) {
        candidateStarts.add(j);
      } else if (U.length >= 2 && computeLineBipartiteWeight(U[1].norm, normSrc[j]) >= edgeThreshold && j > 0) {
        candidateStarts.add(j - 1);
      }
    }

    if (candidateStarts.size === 0) return null;

    let bestMatch = null;
    const minSpan = Math.max(1, U.length - 1);
    const maxSpan = Math.min(srcLines.length, rawSearchLines.length + Math.max(3, Math.ceil(rawSearchLines.length * 0.35)));

    for (const startIdx of candidateStarts) {
      const windowLen = Math.min(maxSpan, srcLines.length - startIdx);
      if (windowLen < minSpan) continue;

      // Himpunan simpul V dalam jendela kandidat [startIdx, startIdx + windowLen - 1]
      const V = [];
      for (let k = 0; k < windowLen; k++) {
        const lineIdx = startIdx + k;
        if (normSrc[lineIdx]) {
          V.push({ winOffset: k, lineIdx, norm: normSrc[lineIdx] });
        }
      }
      if (V.length === 0) continue;

      // Konstruksi graf bipartit G = (U ∪ V, E) dengan syarat bobot w(u_a, v_b) >= edgeThreshold
      const adj = Array.from({ length: U.length }, () => []);
      const weights = Array.from({ length: U.length }, () => ({}));
      for (let a = 0; a < U.length; a++) {
        for (let b = 0; b < V.length; b++) {
          // Jaga kedekatan urutan relatif agar tidak mencocokkan baris yang melompat jauh
          if (Math.abs(a - b) > Math.max(3, Math.ceil(U.length * 0.4))) continue;
          const w = computeLineBipartiteWeight(U[a].norm, V[b].norm);
          if (w >= edgeThreshold) {
            adj[a].push(b);
            weights[a][b] = w;
          }
        }
        // Urutkan tetangga berdasarkan bobot tertinggi terlebih dahulu
        adj[a].sort((b1, b2) => weights[a][b2] - weights[a][b1]);
      }

      // Algoritma Augmenting Path Kőnig-Kuhn untuk mencari Pencocokan Maksimum |M*| = Penutup Simpul Minimum |C*|
      const matchV = new Array(V.length).fill(-1);
      const matchU = new Array(U.length).fill(-1);

      function dfsAugment(u, visited) {
        for (const v of adj[u]) {
          if (visited[v]) continue;
          visited[v] = true;
          if (matchV[v] === -1 || dfsAugment(matchV[v], visited)) {
            matchV[v] = u;
            matchU[u] = v;
            return true;
          }
        }
        return false;
      }

      let matchingCardinality = 0;
      for (let u = 0; u < U.length; u++) {
        const visited = new Array(V.length).fill(false);
        if (dfsAugment(u, visited)) {
          matchingCardinality++;
        }
      }

      const coverageRatio = matchingCardinality / U.length;
      if (coverageRatio < (U.length <= 2 ? 1.0 : 0.75)) continue;

      // Hitung total bobot pencocokan dan rentang baris aktual [matchedStartLine, matchedEndLine]
      let totalWeight = 0;
      let minLineIdx = Infinity;
      let maxLineIdx = -Infinity;
      for (let u = 0; u < U.length; u++) {
        const v = matchU[u];
        if (v !== -1) {
          totalWeight += weights[u][v];
          if (V[v].lineIdx < minLineIdx) minLineIdx = V[v].lineIdx;
          if (V[v].lineIdx > maxLineIdx) maxLineIdx = V[v].lineIdx;
        }
      }

      // Pastikan batas awal dan akhir jendela tercakup dengan baik
      if (matchU[0] === -1 || matchU[U.length - 1] === -1) continue;

      const avgWeight = totalWeight / matchingCardinality;
      const compositeScore = coverageRatio * 0.6 + avgWeight * 0.4;

      if (!bestMatch || compositeScore > bestMatch.compositeScore) {
        bestMatch = {
          startLineIdx: minLineIdx,
          endLineIdx: maxLineIdx,
          matchingCardinality,
          minimumVertexCoverSize: matchingCardinality, // Berdasarkan Teorema Kőnig: |M*| = |C*|
          coverageRatio: Number(coverageRatio.toFixed(4)),
          avgWeight: Number(avgWeight.toFixed(4)),
          compositeScore: Number(compositeScore.toFixed(4))
        };
      }
    }

    if (!bestMatch || bestMatch.compositeScore < 0.76) return null;

    // Terapkan penggantian pada rentang [startLineIdx, endLineIdx] dengan penyesuaian indentasi
    const origIndent = (srcLines[bestMatch.startLineIdx].match(/^\s*/) || [''])[0];
    const rLines = rRaw.split(/\r?\n/);
    const firstNonEmpty = rLines.find(l => l.trim()) || '';
    const rIndent = (firstNonEmpty.match(/^\s*/) || [''])[0];
    const adjustedReplace = rLines.map(l => {
      if (!l.trim()) return l;
      return l.startsWith(rIndent) ? origIndent + l.slice(rIndent.length) : origIndent + l.trim();
    });

    const spanLength = bestMatch.endLineIdx - bestMatch.startLineIdx + 1;
    const updatedLines = [...srcLines];
    updatedLines.splice(bestMatch.startLineIdx, spanLength, ...adjustedReplace);

    return {
      content: updatedLines.join('\n'),
      range: {
        startLine: bestMatch.startLineIdx + 1,
        endLine: bestMatch.startLineIdx + Math.max(1, adjustedReplace.length)
      },
      konigDiagnostics: bestMatch
    };
  }

  // ============================================================================
  // 5. MESIN CONTINUATION INDUKTIF & PENCANGKOKAN SUB-POHON DOM (DOM SUBTREE GRAFTING)
  // Menangani kondisi ketika AI mengeluarkan ribuan token namun terputus di tengah
  // jalan (belum menutup >>>>>>> REPLACE, ```, atau </html>) dengan menyambung
  // stream secara rekursif (Overlap-Free KMP Suffix-Prefix Stitching) serta
  // mencangkokkan fragmen komponen HTML parsial (<section id="kontak">...</section>)
  // ke dalam pohon DOM dokumen utama.
  // ============================================================================
  function detectIncompleteEditStream(text, step = 'patch', kind = 'html') {
    const s = String(text || '');
    if (!s.trim()) return { incomplete: true, reason: 'empty_stream' };

    // 1. Cek blok SEARCH/REPLACE yang belum ditutup
    const gitSearchOpens = (s.match(/^<{3,}[ \t]*SEARCH\b/gim) || []).length;
    const gitReplaceCloses = (s.match(/^>{3,}[ \t]*(?:REPLACE)?[ \t>]*$/gim) || []).length;
    if (gitSearchOpens > gitReplaceCloses) {
      return { incomplete: true, reason: 'unclosed_git_hunk', openCount: gitSearchOpens, closeCount: gitReplaceCloses };
    }

    const zozSearchOpens = (s.match(/<<<SEARCH>>>/gi) || []).length;
    const zozReplaceOpens = (s.match(/<<<REPLACE>>>/gi) || []).length;
    const zozEditCloses = (s.match(/<<<END_ZOZ_EDIT>>>/gi) || []).length;
    if (zozSearchOpens > zozReplaceOpens || (zozSearchOpens > 0 && zozEditCloses === 0 && !/\n```\s*$/.test(s.trim()))) {
      return { incomplete: true, reason: 'unclosed_zoz_hunk', openCount: zozSearchOpens, closeCount: zozEditCloses };
    }

    // 2. Cek blok pagar kode markdown (```) yang ganjil (belum ditutup)
    const fences = (s.match(/```/g) || []).length;
    if (fences % 2 === 1) {
      return { incomplete: true, reason: 'unclosed_code_fence', fences };
    }

    // 3. Cek dokumen HTML utuh yang belum mencapai </html>
    if (kind !== 'jsx' && (step === 'rewrite' || /<!DOCTYPE\s+html|<html[\s>]/i.test(s))) {
      if (/<html[\s>]|<!DOCTYPE\s+html/i.test(s) && !/<\/html\s*>/i.test(s)) {
        return { incomplete: true, reason: 'unclosed_html_document' };
      }
    }

    // 4. Cek tag komponen utama (<section>, <style>, <script>, <header>, <footer>) yang masih menggantung
    for (const tag of ['section', 'style', 'script', 'header', 'footer', 'main', 'nav']) {
      const oCount = (s.match(new RegExp('<' + tag + '(?=[\\s>/])', 'gi')) || []).length;
      const cCount = (s.match(new RegExp('</' + tag + '\\s*>', 'gi')) || []).length;
      if (oCount > cCount && gitSearchOpens === 0 && zozSearchOpens === 0) {
        return { incomplete: true, reason: `unclosed_${tag}_tag`, openCount: oCount, closeCount: cCount };
      }
    }

    return { incomplete: false, reason: 'complete' };
  }

  function stitchContinuationOverlap(accumulated, nextChunk) {
    const a = String(accumulated || '');
    let b = String(nextChunk || '');
    if (!a) return b;
    if (!b) return a;

    // Bersihkan pembuka pagar markdown duplikat jika bagian sebelumnya sedang berada di dalam kode/hunk
    const aFences = (a.match(/```/g) || []).length;
    const aInUnclosedHunk = ((a.match(/^<{3,}[ \t]*SEARCH\b/gim) || []).length > (a.match(/^>{3,}[ \t]*(?:REPLACE)?[ \t>]*$/gim) || []).length);
    if (aFences % 2 === 1 || aInUnclosedHunk || (/<html[\s>]|<!DOCTYPE\s+html/i.test(a) && !/<\/html\s*>/i.test(a))) {
      b = b.replace(/^(?:[^\n<`]*\n)?```[a-zA-Z0-9_-]*\r?\n/, '');
    }

    // 1. Cari tumpang-tindih berbasis baris (hingga 12 baris terakhir dari a terhadap 12 baris pertama dari b)
    const aLines = a.split(/\r?\n/);
    const bLines = b.split(/\r?\n/);
    const maxLineCheck = Math.min(12, aLines.length, bLines.length);
    for (let k = maxLineCheck; k >= 1; k--) {
      let match = true;
      for (let j = 0; j < k; j++) {
        const lineA = aLines[aLines.length - k + j].trim();
        const lineB = bLines[j].trim();
        if (!lineA || lineA !== lineB) {
          match = false;
          break;
        }
      }
      if (match) {
        return aLines.concat(bLines.slice(k)).join('\n');
      }
    }

    // 2. Cari tumpang-tindih berbasis karakter persis (KMP Suffix-Prefix Overlap hingga 350 karakter)
    const maxCharOverlap = Math.min(350, a.length, b.length);
    for (let len = maxCharOverlap; len >= 6; len--) {
      if (a.slice(a.length - len) === b.slice(0, len)) {
        return a + b.slice(len);
      }
    }

    return a + b;
  }

  function findBalancedTagSpan(html, startIndex, tagName) {
    const tagRe = new RegExp('<(\\/?)' + tagName + '(?=[\\s>/])[^>]*>', 'gi');
    tagRe.lastIndex = startIndex;
    let depth = 0;
    let m;
    while ((m = tagRe.exec(html)) !== null) {
      const fullTag = m[0];
      const isClose = m[1] === '/';
      const isSelfClose = /\/\s*>$/.test(fullTag);
      if (isClose) {
        depth--;
        if (depth <= 0) {
          return { start: startIndex, end: m.index + fullTag.length };
        }
      } else if (!isSelfClose) {
        depth++;
      }
    }
    return null;
  }

  function graftPartialHtmlFragment(originalHtml, modelText, userGoal = '') {
    const orig = String(originalHtml || '');
    const raw = String(modelText || '');
    if (!orig.trim() || !raw.trim()) return null;

    // Ekstrak seluruh blok kode dari respons model
    const fragments = [];
    const fenceRe = /```(?:html|css|js|javascript|xml)?[ \t]*\r?\n([\s\S]*?)(?:\r?\n```|$)/gi;
    let m;
    while ((m = fenceRe.exec(raw)) !== null) {
      if (m[1] && m[1].trim()) fragments.push(m[1].trim());
    }
    if (fragments.length === 0) {
      const rawTagMatch = raw.match(/(<(?:section|header|footer|nav|main|article|aside|div|style|script)\b[\s\S]*<\/(?:section|header|footer|nav|main|article|aside|div|style|script)>)/i);
      if (rawTagMatch) fragments.push(rawTagMatch[1].trim());
    }
    if (fragments.length === 0) return null;

    let working = orig;
    const editedRanges = [];
    let graftedCount = 0;

    for (const frag of fragments) {
      // Abaikan jika ini dokumen HTML penuh (ditangani oleh extractFullCode)
      if (/<!DOCTYPE\s+html|<html[\s>]/i.test(frag)) continue;

      // Kasus A: Fragmen adalah blok <style>...</style> atau aturan CSS murni
      if (/^<style\b/i.test(frag) || (!frag.startsWith('<') && /\{[\s\S]*:[\s\S]*\}/.test(frag))) {
        const styleBlock = /^<style\b/i.test(frag) ? frag : `<style>\n${frag}\n</style>`;
        if (/<\/head\s*>/i.test(working)) {
          const idx = working.search(/<\/head\s*>/i);
          const startLine = working.slice(0, idx).split('\n').length;
          working = working.slice(0, idx) + styleBlock + '\n' + working.slice(idx);
          editedRanges.push({ startLine, endLine: startLine + styleBlock.split('\n').length });
          graftedCount++;
          continue;
        }
      }

      // Kasus B: Fragmen adalah elemen komponen HTML (<section>, <header>, <footer>, <nav>, <div ...>)
      const openMatch = frag.match(/^<([a-zA-Z0-9_-]+)\b([^>]*)>/);
      if (!openMatch) continue;
      const tagName = openMatch[1].toLowerCase();
      const attrs = openMatch[2] || '';
      const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
      const classMatch = attrs.match(/\bclass\s*=\s*["']([^"']+)["']/i);

      // B1. Cangkokkan berdasarkan atribut id="..." yang cocok di dokumen asli
      if (idMatch && idMatch[1]) {
        const targetId = idMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const targetOpenRe = new RegExp('<' + tagName + '\\b[^>]*\\bid\\s*=\\s*["\']' + targetId + '["\'][^>]*>', 'i');
        const found = targetOpenRe.exec(working);
        if (found) {
          const span = findBalancedTagSpan(working, found.index, tagName);
          if (span) {
            const startLine = working.slice(0, span.start).split('\n').length;
            working = working.slice(0, span.start) + frag + working.slice(span.end);
            editedRanges.push({ startLine, endLine: startLine + frag.split('\n').length - 1 });
            graftedCount++;
            continue;
          }
        }
      }

      // B2. Cangkokkan ke elemen sejenis berdasarkan kesamaan Bilangan Erdős / Kőnig pada kandidat <section>/<header>/<footer>/<div class="hero...">
      const goalLower = String(userGoal || '').toLowerCase();
      const candidateRe = new RegExp('<' + tagName + '\\b([^>]*)>', 'gi');
      let candMatch;
      let bestSpan = null;
      let bestScore = 0;

      while ((candMatch = candidateRe.exec(working)) !== null) {
        const span = findBalancedTagSpan(working, candMatch.index, tagName);
        if (!span) continue;
        const candidateSubtree = working.slice(span.start, span.end);
        // Jangan ganti wrapper raksasa yang membungkus seluruh body jika fragmen jauh lebih kecil
        if (tagName === 'div' && candidateSubtree.length > working.length * 0.75 && frag.length < candidateSubtree.length * 0.6) {
          continue;
        }
        const candOpenLine = candidateSubtree.split('\n')[0];
        const fragOpenLine = frag.split('\n')[0];
        let score = computeLineBipartiteWeight(normalizeCodeLineForKonig(fragOpenLine), normalizeCodeLineForKonig(candOpenLine));

        // Tambah skor jika kata kunci target pengguna (mis. "hero", "kontak", "footer") ada di dalam kandidat ini
        const goalKeywords = goalLower.match(/\b(hero|header|navbar|nav|kontak|contact|tentang|about|fitur|feature|layanan|service|harga|pricing|testimoni|footer|galeri|cta)\b/g) || [];
        for (const kw of goalKeywords) {
          if (candidateSubtree.toLowerCase().includes(kw) && frag.toLowerCase().includes(kw)) {
            score += 0.35;
          }
        }
        if (classMatch && classMatch[1]) {
          const fragClasses = classMatch[1].split(/\s+/).filter(c => c.length >= 3);
          const candAttrs = (candMatch[1] || '').toLowerCase();
          for (const fc of fragClasses) {
            if (candAttrs.includes(fc.toLowerCase())) score += 0.15;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestSpan = span;
        }
      }

      if (bestSpan && bestScore >= 0.55) {
        const startLine = working.slice(0, bestSpan.start).split('\n').length;
        working = working.slice(0, bestSpan.start) + frag + working.slice(bestSpan.end);
        editedRanges.push({ startLine, endLine: startLine + frag.split('\n').length - 1 });
        graftedCount++;
        continue;
      }

      // B3. Jika merupakan <section> atau <footer> baru (mis. menambahkan #kontak baru), sisipkan sebelum <footer atau </body>
      if (['section', 'footer', 'header', 'nav'].includes(tagName)) {
        const insertBeforeRe = tagName === 'header' || tagName === 'nav'
          ? /<body\b[^>]*>/i
          : (/<footer\b/i.test(working) && tagName !== 'footer' ? /<footer\b/i : /<\/body\s*>/i);
        const insMatch = insertBeforeRe.exec(working);
        if (insMatch) {
          const insPos = (tagName === 'header' || tagName === 'nav') ? (insMatch.index + insMatch[0].length) : insMatch.index;
          const startLine = working.slice(0, insPos).split('\n').length;
          working = working.slice(0, insPos) + '\n' + frag + '\n' + working.slice(insPos);
          editedRanges.push({ startLine, endLine: startLine + frag.split('\n').length });
          graftedCount++;
        }
      }
    }

    if (graftedCount === 0 || working === orig) return null;
    return {
      content: working,
      ranges: editedRanges,
      graftedCount
    };
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
      getState: () => {
        const signalSamples = history.map(p => p.geodesicDist + p.r);
        return {
          lastPoint,
          dyckDepth,
          historyLength: history.length,
          szegoSpectrum: computeSzegoToeplitzSpectrum(signalSamples, 6)
        };
      }
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
    let sampleWindowText = '';
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
        if (sampleWindowText.length < 1600) {
          sampleWindowText += str;
        }
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
        erdosGraph: computeErdosIntentGraph(userPrompt, sampleWindowText),
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
    computeErdosIntentGraph,
    computeSzegoToeplitzSpectrum,
    konigBipartiteMatchHunk,
    detectIncompleteEditStream,
    stitchContinuationOverlap,
    graftPartialHtmlFragment,
    createHyperbolicManifold,
    createEntropyStreamGate
  };
});
