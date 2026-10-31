(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.ZozTextSafety = api;
    root.textSafety = api;
  }
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
    'make', 'create', 'explain', 'tell', 'write', 'give', 'show', 'how', 'what', 'why', 'who', 'maaf',
    'tidak bisa', 'safety', 'hal lain', 'melanggar'
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
      const fileName = options.fileName || '';
      if (fileName && options.useZozHeader) {
        return `<<<ZOZ_FILE name="${fileName}">\n`;
      }
      return `**${cleanSubject}**\n\n`;
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

    function detectHorocycleTrap(windowSize = 32) {
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
      // Abaikan karakter formatting, spasi inden, pemisah tabel (|---|), strip (-) dan simbol syntax
      const substantiveChars = joined.replace(/[\s\-=_*|.#]+/g, '');
      // Deteksi loop degenerasi sejati: pola harus berulang minimal 8 kali dan panjang substantif minimal 150 karakter
      // Mencegah false-positive memotong jawaban normal yang berisi tabel, daftar item, CSS, atau kata berulang normal
      const hasSubstantivePeriodicOrbit = substantiveChars.length >= 150 && /([a-zA-Z0-9\u00C0-\u024F]{3,80})\1{7,}$/s.test(substantiveChars);

      const trapped = hasSubstantivePeriodicOrbit || (busemannVariance < 1e-12 && win.length >= 24 && win[0].token.length >= 4 && win.every(p => p.token === win[0].token));
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
    const MAX_GATE_HOLD_CHARS = options.maxHoldChars || 64;

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

      // 3. Jika token yang tersisa adalah kode/markdown/substansi atau sudah melewati batas tunggu, buka katup seketika!
      const trimmed = lookaheadBuffer.trimStart();
      const isDirectSubstance = /^(?:<!DOCTYPE|<html|<div|<<<ZOZ_FILE|<<<<<<< SEARCH|```|#|\*\*|1\.|- |\{|\[)/i.test(trimmed);
      const hasSentenceOrLineEnd = /[:\n.!?]/.test(lookaheadBuffer);

      const looksLikeIncompletePreamble = /^(?:halo|hai|hi|hello|selamat|wah|pertanyaan|permintaan|topik|ide|tentu|baik|pasti|oke|siap|dengan\s+senang|berikut|sebagai|maaf|mohon\s+maaf|sorry|i\s+apologize|unfortunately|saya\s+tidak|i\s+cannot|i\s+can't|i\s+am\s+unable|as\s+an\s+ai|sure|certainly|of\s+course|here\s+is)\b/i.test(trimmed);

      // Fast-path latensi ultra-rendah (<50ms): Jika bukan awalan basa-basi dan sudah ada 1 token substansi + spasi
      const hasSubstantiveToken = !looksLikeIncompletePreamble && (trimmed.length >= 10 && /\s/.test(trimmed));

      if (isDirectSubstance || hasSubstantiveToken || (hasSentenceOrLineEnd && !looksLikeIncompletePreamble) || lookaheadBuffer.length >= MAX_GATE_HOLD_CHARS || isFinal) {
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

  // ============================================================================
  // 6. PURE MATHEMATICAL INFORMATION RETRIEVAL, RADIOACTIVE TEMPORAL DECAY,
  //    BOLTZMANN ENTROPY CONTROL & HILBERT-SPACE GROUNDING PROJECTION
  //    Menghapus halusinasi & pengambilan informasi usang murni dengan aljabar
  //    linear, peluruhan eksponensial radioaktif W(Δt) = exp(-λ·Δt), skor BM25F,
  //    dan proyeksi ortogonal subruang bukti P_E(u) tanpa instruksi persona AI.
  // ============================================================================

  const MONTH_INDEX_MAP = {
    januari: 1, jan: 1, january: 1,
    februari: 2, feb: 2, february: 2,
    maret: 3, mar: 3, march: 3,
    april: 4, apr: 4,
    mei: 5, may: 5,
    juni: 6, jun: 6, june: 6,
    juli: 7, jul: 7, july: 7,
    agustus: 8, agu: 8, agt: 8, aug: 8, august: 8,
    september: 9, sep: 9, sept: 9,
    oktober: 10, okt: 10, oct: 10, october: 10,
    november: 11, nov: 11,
    desember: 12, des: 12, dec: 12, december: 12
  };

  const ID_MONTH_NAMES = [
    '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const GENERIC_NON_ENTITY_WORDS = new Set([
    'januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
    'january', 'february', 'march', 'may', 'june', 'july', 'august', 'october', 'december',
    'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'agu', 'agt', 'sep', 'sept', 'okt', 'oct', 'nov', 'dec', 'des',
    'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'tahun', 'bulan', 'pekan', 'hari', 'jam', 'menit', 'detik', 'year', 'years', 'month', 'months', 'week', 'weeks', 'day', 'days', 'hour', 'hours',
    'tanggal', 'date', 'abad', 'kuartal', 'quarter', 'semester', 'tahap', 'fase', 'phase', 'stage', 'step', 'langkah',
    'bab', 'chapter', 'pasal', 'ayat', 'bagian', 'part', 'section', 'poin', 'nomor', 'no', 'item', 'baris', 'kolom', 'tabel', 'sumber', 'source',
    'versi', 'version', 'seri', 'series', 'generasi', 'gen', 'tier', 'level', 'kelas', ' peringkat', 'rank', 'top', 'skor', 'score',
    'juta', 'miliar', 'triliun', 'ribu', 'persen', 'percent', 'million', 'billion', 'trillion', 'ribuan',
    'usd', 'idr', 'eur', 'rupiah', 'dolar', 'dollar', 'gb', 'tb', 'mb', 'kb', 'kw', 'mw', 'gw', 'hz', 'ghz', 'mhz', 'nm', 'mm', 'cm', 'km', 'kg', 'fps', 'tps',
    'dari', 'pada', 'untuk', 'dengan', 'dalam', 'hingga', 'sampai', 'antara', 'sekitar', 'lebih', 'kurang', 'hampir', 'mencapai', 'sebesar', 'senilai',
    'over', 'under', 'from', 'into', 'with', 'than', 'more', 'less', 'about', 'around', 'nearly', 'up', 'to', 'in', 'on', 'at', 'by', 'of', 'for', 'the', 'and',
    'rilis', 'dirilis', 'release', 'released', 'update', 'updated', 'model', 'models', 'fitur', 'agen', 'agent', 'agents', 'data', 'kode', 'code', 'api', 'web'
  ]);

  const BILINGUAL_QUERY_BASIS = {
    rilis: ['release', 'releases', 'released', 'launch', 'launches', 'unveils', 'announces'],
    peluncuran: ['launch', 'release', 'unveils'],
    terbaru: ['latest', 'new', 'newest', 'recent'],
    terkini: ['latest', 'breaking', 'current', 'recent'],
    mutakhir: ['frontier', 'latest', 'advanced'],
    berita: ['news', 'report', 'updates'],
    pembaruan: ['update', 'updates', 'upgrade'],
    kecerdasan: ['artificial', 'intelligence', 'ai'],
    makalah: ['paper', 'papers', 'article', 'articles', 'preprint', 'study'],
    jurnal: ['journal', 'paper', 'research'],
    riset: ['research', 'study', 'findings', 'paper'],
    ilmiah: ['scientific', 'academic', 'research'],
    terbaik: ['best', 'top', 'leading', 'benchmark'],
    model: ['model', 'models', 'llm', 'architecture'],
    penalaran: ['reasoning', 'thinking'],
    terbuka: ['open', 'weights', 'source'],
    harga: ['price', 'pricing', 'cost'],
    saham: ['stock', 'stocks', 'market'],
    gempa: ['earthquake', 'seismic'],
    perang: ['war', 'conflict']
  };

  const IR_STOPWORDS = new Set([
    ...STOPWORDS_AND_VERBS,
    'cari', 'carikan', 'coba', 'tolong', 'web', 'internet', 'google', 'search', 'find', 'look',
    'terbaru', 'terkini', 'hari', 'minggu', 'bulan', 'tahun', 'sekarang', 'saat', 'latest', 'recent',
    'today', 'week', 'month', 'year', 'now', 'current', 'new', 'baru'
  ]);

  function parseAuthenticTimestamp(rawDateStr, urlStr = '', bodyStr = '', nowMs = Date.now()) {
    const maxFutureMs = nowMs + 36 * 3600 * 1000;
    const minValidMs = Date.UTC(1995, 0, 1);

    const tryEpoch = (ms) => {
      if (!Number.isFinite(ms)) return null;
      if (ms < minValidMs || ms > maxFutureMs) return null;
      return ms;
    };

    const raw = String(rawDateStr || '').trim();
    if (raw && !/^(?:terkini|baru|latest|recent|today|now|n\/a|unknown|-)$/i.test(raw)) {
      // Relative time expressions: "3 hours ago", "2 days ago", "5 jam lalu"
      const relMatch = raw.match(/(\d+)\s*(detik|menit|jam|hari|minggu|bulan|second|minute|hour|day|week|month)s?\s*(?:yang\s+)?(?:lalu|ago)/i);
      if (relMatch) {
        const val = parseInt(relMatch[1], 10);
        const unit = relMatch[2].toLowerCase();
        const mult = unit.startsWith('det') || unit.startsWith('sec') ? 1000
          : unit.startsWith('men') || unit.startsWith('min') ? 60000
          : unit.startsWith('jam') || unit.startsWith('hour') ? 3600000
          : unit.startsWith('har') || unit.startsWith('day') ? 86400000
          : unit.startsWith('ming') || unit.startsWith('week') ? 7 * 86400000
          : 30 * 86400000;
        const t = tryEpoch(nowMs - val * mult);
        if (t !== null) return t;
      }

      // Pure ISO / RFC-2822 parse (reject bare 4-digit year string alone as ambiguous)
      if (!/^\d{4}$/.test(raw)) {
        const parsed = Date.parse(raw);
        const valid = tryEpoch(parsed);
        if (valid !== null) return valid;
      }

      // Indonesian / textual date in rawDateStr (e.g., "30 Oktober 2026")
      const coords = extractCalendarDateCoordinates(raw);
      if (coords.length > 0 && coords[0].year) {
        const c = coords[0];
        const valid = tryEpoch(Date.UTC(c.year, c.month - 1, c.day || 15, 12, 0, 0));
        if (valid !== null) return valid;
      }
    }

    // Extract from URL path: /2026/10/30/ or -20261029- or /2026-10-30
    const u = String(urlStr || '');
    if (u) {
      const urlYmd = u.match(/(?:\/|[-_])(20[0-2]\d)[\/\-_](0[1-9]|1[0-2])[\/\-_](0[1-9]|[12]\d|3[01])(?:\/|[-_.]|$)/);
      if (urlYmd) {
        const valid = tryEpoch(Date.UTC(parseInt(urlYmd[1], 10), parseInt(urlYmd[2], 10) - 1, parseInt(urlYmd[3], 10), 12, 0, 0));
        if (valid !== null) return valid;
      }
      const urlCompact = u.match(/(?:\/|[-_])(20[0-2]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:[-_/.]|$)/);
      if (urlCompact) {
        const valid = tryEpoch(Date.UTC(parseInt(urlCompact[1], 10), parseInt(urlCompact[2], 10) - 1, parseInt(urlCompact[3], 10), 12, 0, 0));
        if (valid !== null) return valid;
      }
      const urlYm = u.match(/\/(20[0-2]\d)\/(0[1-9]|1[0-2])\//);
      if (urlYm) {
        const valid = tryEpoch(Date.UTC(parseInt(urlYm[1], 10), parseInt(urlYm[2], 10) - 1, 15, 12, 0, 0));
        if (valid !== null) return valid;
      }
    }

    // Extract from leading article body header (first 400 chars often contain byline date)
    const head = String(bodyStr || '').slice(0, 450);
    if (head) {
      const coords = extractCalendarDateCoordinates(head);
      const withYear = coords.find(c => c.year && c.hasDay);
      if (withYear) {
        const valid = tryEpoch(Date.UTC(withYear.year, withYear.month - 1, withYear.day, 12, 0, 0));
        if (valid !== null) return valid;
      }
    }

    return null;
  }

  function extractCalendarDateCoordinates(text, fallbackYear = null) {
    const s = String(text || '');
    if (!s) return [];
    const results = [];
    const seen = new Set();

    const pushCoord = (year, month, day, hasDay, raw) => {
      const y = year ? parseInt(year, 10) : fallbackYear;
      const m = parseInt(month, 10);
      const d = hasDay ? parseInt(day, 10) : 15;
      if (!m || m < 1 || m > 12 || d < 1 || d > 31) return;
      if (y && (y < 1990 || y > 2099)) return;
      const epochDays = y ? Math.floor(Date.UTC(y, m - 1, d) / 86400000) : null;
      const key = `${y || '?'}-${m}-${hasDay ? d : 'M'}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ year: y || null, month: m, day: hasDay ? d : null, hasDay, epochDays, raw: raw.trim() });
      }
    };

    const monthPat = Object.keys(MONTH_INDEX_MAP).join('|');

    // 1. ISO YYYY-MM-DD or YYYY/MM/DD
    const isoRe = /\b(20[0-3]\d)[-\/](0[1-9]|1[0-2])[-\/](0[1-9]|[12]\d|3[01])\b/g;
    let m;
    while ((m = isoRe.exec(s)) !== null) {
      pushCoord(m[1], m[2], m[3], true, m[0]);
    }

    // 2. DD Month [YYYY] (Indonesian & RFC: "12 Oktober 2026", "5 Okt", "30 Oct 2026")
    const dmyRe = new RegExp(`\\b([0-3]?\\d)\\s+(${monthPat})(?:[.,]?\\s*(20[0-3]\\d))?\\b`, 'gi');
    while ((m = dmyRe.exec(s)) !== null) {
      const dayNum = parseInt(m[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const monIdx = MONTH_INDEX_MAP[m[2].toLowerCase()];
        if (monIdx) pushCoord(m[3] || fallbackYear, monIdx, dayNum, true, m[0]);
      }
    }

    // 3. Month DD[, YYYY] (English: "October 30, 2026", "Oct 27")
    const mdyRe = new RegExp(`\\b(${monthPat})\\.?\\s+([0-3]?\\d)(?:st|nd|rd|th)?(?:\\s*,?\\s*(20[0-3]\\d))?\\b`, 'gi');
    while ((m = mdyRe.exec(s)) !== null) {
      const dayNum = parseInt(m[2], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const monIdx = MONTH_INDEX_MAP[m[1].toLowerCase()];
        if (monIdx) pushCoord(m[3] || fallbackYear, monIdx, dayNum, true, m[0]);
      }
    }

    // 4. Month YYYY without day ("Sep 2026", "September 2026", "Oktober 2026")
    const myRe = new RegExp(`\\b(${monthPat})\\.?\\s+(20[0-3]\\d)\\b`, 'gi');
    while ((m = myRe.exec(s)) !== null) {
      const monIdx = MONTH_INDEX_MAP[m[1].toLowerCase()];
      if (monIdx) pushCoord(m[2], monIdx, 15, false, m[0]);
    }

    return results;
  }

  function extractVersionedEntityAnchors(text) {
    const s = String(text || '');
    if (!s) return [];
    const anchors = new Set();

    // 1. Formal morphological <Entity>[ -]<Version> extractor:
    //    Matches e.g. "Claude 3.7", "Claude 3.5", "Claude 3 Opus", "Gemma 4", "Genie 4",
    //    "Llama 4", "Large 4", "GPT-6.1", "GPT-5", "GPT-4o", "Qwen 2.5", "DeepSeek-V3", "DeepSeek R1", "Gemini 2.0"
    const entityVerRe = /\b([A-Za-z][A-Za-z0-9]{1,18})(?:[\s\-]+)(v?\d+(?:\.\d+)*[a-z]?|r[12]\b|v[1-9](?:\.\d+)?)\b/gi;
    let m;
    while ((m = entityVerRe.exec(s)) !== null) {
      const ent = m[1].toLowerCase();
      let ver = m[2].toLowerCase();
      if (GENERIC_NON_ENTITY_WORDS.has(ent)) continue;
      if (STOPWORDS_AND_VERBS.has(ent) || LOW_ENTROPY_FILLERS.has(ent)) continue;
      // Ignore 4-digit calendar years (1990-2039) and parameter/context sizes (70b, 31b, 128k, 100m)
      if (/^(?:19\d\d|20[0-3]\d)$/.test(ver)) continue;
      if (/^\d+(?:\.\d+)?[bkmgt]$/i.test(ver) && !/^v\d/i.test(ver)) continue;
      // Ignore pure counts >= 25 unless decimal or prefixed with v/r (versions are typically 1..24 or x.y)
      if (/^\d+$/.test(ver) && parseInt(ver, 10) > 24) continue;
      ver = ver.replace(/^v(?=\d)/, '');
      // Normalize trailing .0 (e.g. "2.0" -> "2" so "Gemini 2.0" == "Gemini 2")
      ver = ver.replace(/^(\d+)\.0$/, '$1');
      anchors.add(`${ent}:${ver}`);
    }

    // 2. Standalone reasoning / frontier shorthand model codes: o1, o3, o4-mini, r1
    const codeRe = /\b(o1(?:-mini|-pro|-preview)?|o3(?:-mini|-pro)?|o4(?:-mini)?)\b/gi;
    while ((m = codeRe.exec(s)) !== null) {
      const baseCode = m[1].toLowerCase().split('-')[0];
      anchors.add(`code:${baseCode}`);
    }

    return [...anchors];
  }

  function computeTemporalRecencyProfile(query, contextText = '', nowMs = Date.now()) {
    const q = String(query || '').trim();
    const combined = `${q} ${String(contextText || '')}`.trim();
    const curYear = new Date(nowMs).getUTCFullYear();

    const isCodeOrCreative = /\b(?:html|css|javascript|typescript|python|java|rust|golang|sql|regex|website|landing\s*page|komponen|buatkan\s+(?:kode|script|fungsi|program|puisi|cerpen|cerita|lagu|musik|surat|makalah|dokumen))\b/i.test(q)
      || /<<<ZOZ_FILE|<<<<<<< SEARCH|```/.test(q);

    // Noisy-OR fusion over temporal & epistemic retrieval operators
    const probs = [];
    let halfLifeDays = 365;

    const explicitWebOp = /\b(?:cari(?:kan)?\s+di\s+(?:web|internet|google)|search\s+(?:the\s+)?(?:web|internet|online)|telusuri(?:\s+web|\s+internet)?|cek\s+di\s+(?:web|internet)|browsing)\b/i.test(q);
    if (explicitWebOp) {
      probs.push(0.96);
      halfLifeDays = Math.min(halfLifeDays, 21);
    }

    const immediateRecency = /\b(?:hari\s+ini|kemarin|barusan|sekarang|minggu\s+ini|pekan\s+ini|today|yesterday|right\s+now|this\s+week|breaking\s+news)\b/i.test(q);
    if (immediateRecency) {
      probs.push(0.95);
      halfLifeDays = Math.min(halfLifeDays, 10);
    }

    const generalRecency = /\b(?:terbaru|terkini|mutakhir|bulan\s+ini|tahun\s+ini|latest|newest|most\s+recent|this\s+month|current\s+release|rilis\s+.*\bbaru|new\s+release)\b/i.test(q);
    if (generalRecency) {
      probs.push(0.90);
      halfLifeDays = Math.min(halfLifeDays, 18);
    }

    const releaseOrNewsTopic = /\b(?:rilis|peluncuran|berita|kabar|pengumuman|update|pembaruan|harga|kurs|skor|klasemen|jadwal|cuaca|gempa|release|launch|announcement|news|price)\b/i.test(q);
    if (releaseOrNewsTopic) {
      probs.push(0.55);
      halfLifeDays = Math.min(halfLifeDays, 30);
    }

    // Explicit year detection
    const yearMatches = (q.match(/\b(199\d|20[0-3]\d)\b/g) || []).map(Number);
    const hasCurrentYear = yearMatches.includes(curYear);
    const historicalYears = yearMatches.filter(y => y < curYear);

    if (hasCurrentYear) {
      probs.push(0.88);
      halfLifeDays = Math.min(halfLifeDays, 21);
    }

    let targetHistoricalYear = null;
    if (historicalYears.length > 0 && !hasCurrentYear && !immediateRecency && !generalRecency) {
      targetHistoricalYear = historicalYears[0];
    }

    let recencyAlpha = 0.15;
    if (targetHistoricalYear !== null) {
      recencyAlpha = 0.0;
    } else if (probs.length > 0) {
      let complement = 1.0;
      for (const p of probs) complement *= (1.0 - p);
      recencyAlpha = 1.0 - complement;
    }

    // Check contextual continuity (e.g. follow-up turn about recent news)
    if (recencyAlpha < 0.5 && !targetHistoricalYear && /\b(?:terbaru|terkini|latest|2026|oktober|october)\b/i.test(combined)) {
      recencyAlpha = Math.max(recencyAlpha, 0.55);
      halfLifeDays = Math.min(halfLifeDays, 30);
    }

    const lambda = Math.LN2 / Math.max(1, halfLifeDays);
    const epistemicSearchTrigger = isCodeOrCreative ? 0.0 : (explicitWebOp ? 0.98 : recencyAlpha);

    return {
      recencyAlpha: Number(recencyAlpha.toFixed(4)),
      halfLifeDays,
      lambda: Number(lambda.toFixed(6)),
      targetHistoricalYear,
      curYear,
      explicitWebOp,
      epistemicSearchTrigger: Number(epistemicSearchTrigger.toFixed(4))
    };
  }

  function tokenizeForIR(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}._-]/gu, ' ')
      .split(/\s+/)
      .map(t => t.replace(/^[._-]+|[._-]+$/g, ''))
      .filter(t => t.length >= 2);
  }

  function expandQueryTokensMathematically(query, curYear) {
    const rawTokens = tokenizeForIR(query);
    const expanded = new Map();
    for (const t of rawTokens) {
      if (t === String(curYear)) {
        expanded.set(t, 0.25);
        continue;
      }
      const syns = BILINGUAL_QUERY_BASIS[t];
      if (syns) {
        for (const syn of syns) {
          expanded.set(syn, Math.max(expanded.get(syn) || 0, 0.85));
        }
      }
      if (IR_STOPWORDS.has(t)) continue;
      expanded.set(t, Math.max(expanded.get(t) || 0, 1.0));
    }
    // If all tokens were stopwords/temporal (e.g. "berita terbaru hari ini"), retain core topical tokens
    if (expanded.size === 0) {
      for (const t of rawTokens) {
        if (t.length >= 2) expanded.set(t, 0.7);
      }
    }
    return expanded;
  }

  function rankDocumentsMathematically(candidates, query, options = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    const nowMs = options.nowMs || Date.now();
    const profile = options.profile || computeTemporalRecencyProfile(query, options.contextText || '', nowMs);
    const queryWeights = expandQueryTokensMathematically(query, profile.curYear);
    const qTerms = [...queryWeights.keys()];

    // Pre-tokenize documents & extract authentic timestamps
    const docs = candidates.map((item) => {
      const title = String(item.title || '');
      const snippet = String(item.snippet || '');
      const content = String(item.content || '');
      const url = String(item.url || item.link || '');
      const rawDate = item.published_at || item.pubDate || item.published_date || item.date || '';

      const titleTokens = tokenizeForIR(title);
      const snippetTokens = tokenizeForIR(snippet);
      const contentTokens = tokenizeForIR(content.slice(0, 4000));

      const tfTitle = new Map();
      const tfSnippet = new Map();
      const tfContent = new Map();
      for (const t of titleTokens) tfTitle.set(t, (tfTitle.get(t) || 0) + 1);
      for (const t of snippetTokens) tfSnippet.set(t, (tfSnippet.get(t) || 0) + 1);
      for (const t of contentTokens) tfContent.set(t, (tfContent.get(t) || 0) + 1);

      const docLen = titleTokens.length * 2 + snippetTokens.length + contentTokens.length;
      const verifiedTs = parseAuthenticTimestamp(rawDate, url, `${title} ${snippet} ${content.slice(0, 400)}`, nowMs);
      const ageDays = verifiedTs !== null ? ((nowMs - verifiedTs) / 86400000) : null;

      return {
        item,
        url,
        titleTokens,
        tfTitle,
        tfSnippet,
        tfContent,
        docLen: Math.max(1, docLen),
        verifiedTs,
        ageDays
      };
    });

    const N = docs.length;
    const avgdl = docs.reduce((acc, d) => acc + d.docLen, 0) / Math.max(1, N);

    // Compute IDF(q) across candidate corpus
    const idfMap = new Map();
    for (const qt of qTerms) {
      let df = 0;
      for (const d of docs) {
        if (d.tfTitle.has(qt) || d.tfSnippet.has(qt) || d.tfContent.has(qt)) df++;
      }
      // Smooth Robertson-Sparck Jones IDF with floor so shared topical terms in pre-filtered pools stay positive
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5)) + 0.35;
      idfMap.set(qt, idf);
    }

    const freshVerifiedCount = docs.filter(d => d.ageDays !== null && d.ageDays >= -1.5 && d.ageDays <= 60).length;

    const k1 = 1.5;
    const b = 0.75;
    const kappa = 3.2;

    const scored = [];
    for (const d of docs) {
      // 1. Field-weighted Okapi BM25F
      let bm25 = 0;
      let matchedDistinct = 0;
      for (const [qt, qWeight] of queryWeights.entries()) {
        const fT = d.tfTitle.get(qt) || 0;
        const fS = d.tfSnippet.get(qt) || 0;
        const fC = d.tfContent.get(qt) || 0;
        const pseudoFreq = 4.0 * fT + 2.0 * fS + 1.0 * fC;
        if (pseudoFreq > 0) {
          matchedDistinct++;
          const idf = idfMap.get(qt) || 0.5;
          const denom = pseudoFreq + k1 * (1 - b + b * (d.docLen / Math.max(1, avgdl)));
          bm25 += qWeight * idf * ((pseudoFreq * (k1 + 1)) / denom);
        }
      }

      if (bm25 <= 0 || matchedDistinct === 0) {
        if (options.keepCandidateFloor || options.isWhitelistedPool) {
          bm25 = 0.5;
        } else {
          continue;
        }
      }
      const lexNorm = bm25 / (bm25 + kappa);

      // 2. Exponential Radioactive Temporal Decay W_time(Δt) = exp(-λ · Δt)
      let temporalWeight = 1.0;
      if (profile.targetHistoricalYear !== null) {
        if (d.verifiedTs !== null) {
          const docYear = new Date(d.verifiedTs).getUTCFullYear();
          const yearDiff = docYear - profile.targetHistoricalYear;
          temporalWeight = Math.exp(-(yearDiff * yearDiff) / 2.0);
        } else {
          temporalWeight = 0.4;
        }
      } else if (d.ageDays !== null) {
        if (d.ageDays < -1.5) {
          // Causal cone violation (impossible future publication timestamp)
          continue;
        }
        // Hard horizon cutoff when query demands fresh info and fresh documents exist
        if (profile.recencyAlpha >= 0.72 && freshVerifiedCount >= 2 && d.ageDays > 120) {
          continue;
        }
        temporalWeight = Math.exp(-profile.lambda * Math.max(0, d.ageDays));
      } else {
        // Unverified / missing publication timestamp penalty under maximum entropy prior
        const combinedLower = `${d.item.title || ''} ${d.item.snippet || ''}`.toLowerCase();
        const mentionsPastYear = /\b(201\d|202[0-5])\b/.test(combinedLower) && !combinedLower.includes(String(profile.curYear));
        if (profile.recencyAlpha >= 0.72) {
          if (mentionsPastYear || freshVerifiedCount >= 3) {
            temporalWeight = mentionsPastYear ? 0.0 : 0.06;
          } else {
            temporalWeight = 0.18;
          }
        } else {
          temporalWeight = 0.65;
        }
      }

      if (temporalWeight <= 1e-6) continue;

      // 3. Joint Multiplicative-Harmonic Retrieval Score
      const alpha = profile.recencyAlpha;
      const blend = (1 - alpha) + alpha * temporalWeight;
      const mathScore = lexNorm * blend * Math.pow(temporalWeight, alpha);

      if (mathScore <= 1e-5) continue;

      const isoDate = d.verifiedTs !== null ? new Date(d.verifiedTs).toISOString().slice(0, 10) : '';

      scored.push({
        ...d.item,
        timestamp: d.verifiedTs || 0,
        pubDate: isoDate || (d.verifiedTs !== null ? d.item.pubDate : ''),
        published_at: d.verifiedTs !== null ? (d.item.published_at || isoDate) : '',
        mathDiagnostics: {
          mathScore: Number(mathScore.toFixed(5)),
          bm25Score: Number(bm25.toFixed(4)),
          lexNorm: Number(lexNorm.toFixed(4)),
          temporalWeight: Number(temporalWeight.toFixed(5)),
          ageDays: d.ageDays !== null ? Number(d.ageDays.toFixed(2)) : null,
          recencyAlpha: alpha
        }
      });
    }

    scored.sort((a, b) => b.mathDiagnostics.mathScore - a.mathDiagnostics.mathScore);
    return scored;
  }

  function computeOptimalSamplingTemperature(recencyProfile, hasGroundedEvidence = false) {
    if (hasGroundedEvidence) {
      // Sharpen Boltzmann distribution P_T(w) ∝ exp(z_w / T) toward MAP context mode
      return { temperature: 0.05, top_p: 0.82, topP: 0.82 };
    }
    const alpha = recencyProfile && typeof recencyProfile.recencyAlpha === 'number'
      ? recencyProfile.recencyAlpha
      : 0.15;
    const temp = Math.max(0.10, Number((0.70 * (1 - 0.80 * alpha)).toFixed(2)));
    const pVal = alpha >= 0.7 ? 0.85 : 0.92;
    return { temperature: temp, top_p: pVal, topP: pVal };
  }

  function buildCharNgramSet(text, n = 4) {
    const clean = String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const set = new Set();
    for (let i = 0; i <= clean.length - n; i++) {
      set.add(clean.slice(i, i + n));
    }
    return set;
  }

  function projectGroundedResponseMathematically(responseText, sources, rawToolText = '', options = {}) {
    const raw = String(responseText || '');
    if (!raw.trim() || !Array.isArray(sources) || sources.length === 0) {
      return { text: raw, prunedCount: 0, dateCorrections: 0, hallucinationRate: 0 };
    }

    const nowMs = options.nowMs || Date.now();
    const nowDate = new Date(nowMs);
    const curYear = nowDate.getUTCFullYear();
    const todayEpochDays = Math.floor(nowMs / 86400000);

    // 1. Construct Verified Evidence Anchor Sets A_ver(E), A_date(E), and Invariant Token Space I(E)
    const evidenceDocs = sources.map((s) => {
      const docText = [
        s.title || '',
        s.snippet || '',
        s.content || '',
        s.pubDate || '',
        s.published_at || '',
        s.published_date || '',
        s.date || '',
        s.url || ''
      ].join(' ');
      const ts = parseAuthenticTimestamp(
        s.published_at || s.pubDate || s.published_date || s.date || '',
        s.url || '',
        docText,
        nowMs
      );
      const docDates = extractCalendarDateCoordinates(docText, curYear);
      if (ts !== null) {
        const dt = new Date(ts);
        docDates.unshift({
          year: dt.getUTCFullYear(),
          month: dt.getUTCMonth() + 1,
          day: dt.getUTCDate(),
          hasDay: true,
          epochDays: Math.floor(ts / 86400000),
          raw: dt.toISOString().slice(0, 10)
        });
      }
      return {
        source: s,
        docText,
        tokens: new Set(tokenizeForIR(docText)),
        ngrams: buildCharNgramSet(docText, 4),
        verAnchors: new Set(extractVersionedEntityAnchors(docText)),
        dates: docDates,
        ts
      };
    });

    const fullEvidenceCorpus = `${String(rawToolText || '')}\n${evidenceDocs.map(d => d.docText).join('\n')}`;
    const verifiedVerAnchors = new Set(extractVersionedEntityAnchors(fullEvidenceCorpus));
    const verifiedTokens = new Set(tokenizeForIR(fullEvidenceCorpus));

    // Also index entity stems that have verified versions so we recognize version mismatches cleanly
    const verifiedDayEpochSet = [];
    const verifiedMonthSet = new Set();
    // Allow today's system date as a valid meta-reference ("per 31 Oktober 2026")
    verifiedDayEpochSet.push(todayEpochDays);
    verifiedMonthSet.add(`${curYear}-${nowDate.getUTCMonth() + 1}`);

    for (const d of evidenceDocs) {
      for (const dc of d.dates) {
        if (dc.epochDays !== null && dc.hasDay) verifiedDayEpochSet.push(dc.epochDays);
        if (dc.year && dc.month) verifiedMonthSet.add(`${dc.year}-${dc.month}`);
      }
    }
    for (const dc of extractCalendarDateCoordinates(rawToolText, curYear)) {
      if (dc.epochDays !== null && dc.hasDay) verifiedDayEpochSet.push(dc.epochDays);
      if (dc.year && dc.month) verifiedMonthSet.add(`${dc.year}-${dc.month}`);
    }

    const hasVerifiedDates = verifiedDayEpochSet.length > 1;

    const isDateSupported = (coord, sentenceContext = '') => {
      const isForward = /\b(target|proyeksi|prediksi|rencana|jadwal|dijadwalkan|akan|menuju|hingga|sampai|mendatang|perkiraan|roadmap|expected|projected|forecast|scheduled|upcoming)\b/i.test(sentenceContext);
      if (coord.epochDays !== null && coord.epochDays > todayEpochDays + 1 && !isForward) {
        // Future date claimed as past/present fact: must exist verbatim in evidence
        return verifiedDayEpochSet.some(ed => Math.abs(ed - coord.epochDays) <= 1);
      }
      if (isForward) return true;
      if (!hasVerifiedDates) return true;
      if (coord.hasDay && coord.epochDays !== null) {
        // Tolerance ±1 day for UTC <-> local timezone (WIB/PDT) boundary shifts
        return verifiedDayEpochSet.some(ed => Math.abs(ed - coord.epochDays) <= 1);
      }
      if (!coord.hasDay && coord.year && coord.month) {
        return verifiedMonthSet.has(`${coord.year}-${coord.month}`);
      }
      return true;
    };

    const computeMaxDocSimilarity = (unitText) => {
      const uNgrams = buildCharNgramSet(unitText, 4);
      if (uNgrams.size === 0) return 0;
      let bestSim = 0;
      let bestDoc = null;
      for (const d of evidenceDocs) {
        let inter = 0;
        for (const ng of uNgrams) {
          if (d.ngrams.has(ng)) inter++;
        }
        const sim = inter / Math.max(1, uNgrams.size);
        if (sim > bestSim) {
          bestSim = sim;
          bestDoc = d;
        }
      }
      return { bestSim, bestDoc };
    };

    const computeInvariantSupport = (unitText) => {
      // Extract capitalized proper nouns / tech identifiers / numbers not in Indonesian stopwords
      const rawWords = String(unitText || '').match(/\b[A-Z][A-Za-z0-9._-]{1,20}\b|\b[a-z]+[0-9][a-z0-9._-]*\b/g) || [];
      const invariants = [];
      for (const w of rawWords) {
        const lw = w.toLowerCase();
        if (GENERIC_NON_ENTITY_WORDS.has(lw) || STOPWORDS_AND_VERBS.has(lw) || LOW_ENTROPY_FILLERS.has(lw)) continue;
        if (/^(?:tabel|ringkasan|analisis|catatan|kesimpulan|poin|tren|pola|rekap|model|rilis|kategori|pengembang|sorotan|utama|indonesia|dunia|global)$/i.test(lw)) continue;
        invariants.push(lw);
      }
      if (invariants.length === 0) return { count: 0, ratio: 1 };
      let hits = 0;
      for (const inv of invariants) {
        if (verifiedTokens.has(inv) || [...verifiedTokens].some(vt => vt.length >= 4 && inv.length >= 4 && (vt.includes(inv) || inv.includes(vt)))) {
          hits++;
        }
      }
      return { count: invariants.length, ratio: hits / invariants.length };
    };

    // 2. Line-by-line & Structural Block Projection (preserving code fences)
    const lines = raw.split(/\r?\n/);
    const projectedLines = [];
    let inCodeFence = false;
    let prunedCount = 0;
    let dateCorrections = 0;
    let evaluatedClaims = 0;

    // Track section headings so if a heading introduces an ungrounded entity (or loses all body lines), we prune it cleanly
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();

      if (/^```/.test(trimmed)) {
        inCodeFence = !inCodeFence;
        projectedLines.push(line);
        continue;
      }
      if (inCodeFence || !trimmed) {
        projectedLines.push(line);
        continue;
      }

      // A. Markdown Table Row Projection: | col1 | col2 | ... |
      const isTableRow = /^\|.*\|$/.test(trimmed);
      const isTableSeparator = /^\|[\s:|-]+\|$/.test(trimmed);
      if (isTableRow && !isTableSeparator) {
        // Detect if header row (next line is |---|---|)
        const nextTrimmed = (lines[i + 1] || '').trim();
        const isTableHeader = /^\|[\s:|-]+\|$/.test(nextTrimmed);
        if (isTableHeader) {
          projectedLines.push(line);
          continue;
        }

        evaluatedClaims++;
        const rowVers = extractVersionedEntityAnchors(trimmed);
        const rowDates = extractCalendarDateCoordinates(trimmed, curYear);
        const inv = computeInvariantSupport(trimmed);

        // Rule T1: Disjoint versioned entity in table row -> project out
        if (rowVers.length > 0) {
          const hasAnySupportedVer = rowVers.some(v => verifiedVerAnchors.has(v));
          if (!hasAnySupportedVer) {
            prunedCount++;
            continue;
          }
        }

        // Rule T2: Unsupported calendar date coordinate in table row
        if (rowDates.length > 0) {
          const allDatesValid = rowDates.every(dc => isDateSupported(dc, trimmed));
          if (!allDatesValid) {
            // If entity IS supported in a specific dated evidence doc, project the date cell to the verified date!
            const { bestSim, bestDoc } = computeMaxDocSimilarity(trimmed);
            const hasSupportedVer = rowVers.length > 0 && rowVers.some(v => verifiedVerAnchors.has(v));
            if ((hasSupportedVer || bestSim >= 0.28) && bestDoc && bestDoc.ts !== null) {
              const dt = new Date(bestDoc.ts);
              const trueDateStr = `${dt.getUTCDate()} ${ID_MONTH_NAMES[dt.getUTCMonth() + 1]} ${dt.getUTCFullYear()}`;
              for (const badDc of rowDates) {
                if (!isDateSupported(badDc, trimmed) && badDc.raw) {
                  line = line.replace(badDc.raw, trueDateStr);
                  dateCorrections++;
                }
              }
              projectedLines.push(line);
              continue;
            }
            prunedCount++;
            continue;
          }
        }

        // Rule T3: Zero invariant support across multi-entity table row
        if (inv.count >= 2 && inv.ratio === 0) {
          prunedCount++;
          continue;
        }

        projectedLines.push(line);
        continue;
      }

      if (isTableSeparator) {
        projectedLines.push(line);
        continue;
      }

      // B. Heading Projection (## ... or **1. Title (Date)**)
      const isMarkdownHeading = /^#{1,6}\s+/.test(trimmed);
      const isBoldSubheading = /^\*\*(?:\d+\.\s*)?[^*\n]{4,90}\*\*\s*$/.test(trimmed);
      if (isMarkdownHeading || isBoldSubheading) {
        const hVers = extractVersionedEntityAnchors(trimmed);
        if (hVers.length > 0 && !hVers.some(v => verifiedVerAnchors.has(v))) {
          // Entire sub-section header is about a non-existent / stale parametric model!
          // Skip this heading AND skip immediately following bullets/lines belonging to this ungrounded entity until next heading/blank section
          prunedCount++;
          evaluatedClaims++;
          let j = i + 1;
          while (j < lines.length) {
            const nt = lines[j].trim();
            if (/^#{1,6}\s+/.test(nt) || /^\*\*(?:\d+\.\s*)?[^*\n]{4,90}\*\*\s*$/.test(nt) || /^\|.*\|$/.test(nt) || /^---+$/.test(nt)) {
              break;
            }
            if (nt) {
              const nextVers = extractVersionedEntityAnchors(nt);
              // Stop skipping if a new paragraph introduces a verified entity from E
              if (nextVers.length > 0 && nextVers.some(v => verifiedVerAnchors.has(v))) {
                break;
              }
            }
            j++;
          }
          i = j - 1;
          continue;
        }

        // Correct or strip unverified date inside a valid heading
        const hDates = extractCalendarDateCoordinates(trimmed, curYear);
        for (const dc of hDates) {
          if (!isDateSupported(dc, trimmed) && dc.raw) {
            const { bestDoc } = computeMaxDocSimilarity(trimmed);
            if (bestDoc && bestDoc.ts !== null) {
              const dt = new Date(bestDoc.ts);
              const trueDateStr = `${dt.getUTCDate()} ${ID_MONTH_NAMES[dt.getUTCMonth() + 1]} ${dt.getUTCFullYear()}`;
              line = line.replace(dc.raw, trueDateStr);
              dateCorrections++;
            }
          }
        }
        projectedLines.push(line);
        continue;
      }

      // C. Prose Paragraph / Bullet Item Projection
      const pVers = extractVersionedEntityAnchors(trimmed);
      const pDates = extractCalendarDateCoordinates(trimmed, curYear);

      if (pVers.length > 0 || pDates.length > 0) {
        evaluatedClaims++;

        // C1. Disjoint versioned entity assertion -> prune node & its unanchored child bullets in Markdown AST
        if (pVers.length > 0 && !pVers.some(v => verifiedVerAnchors.has(v))) {
          prunedCount++;
          const isTopBullet = /^\s*(?:[-*•]|\d+\.)\s+/.test(line);
          const curIndent = (line.match(/^\s*/) || [''])[0].length;
          let j = i + 1;
          while (j < lines.length) {
            const rawNext = lines[j];
            const nt = rawNext.trim();
            if (!nt) {
              // Peek past single blank line only if followed by child bullets of a non-bullet intro paragraph
              const afterBlank = (lines[j + 1] || '').trim();
              if (!isTopBullet && /^(?:[-*•])\s+/.test(afterBlank)) {
                j++;
                continue;
              }
              break;
            }
            if (/^#{1,6}\s+/.test(nt) || /^\|.*\|$/.test(nt) || /^---+$/.test(nt) || /^```/.test(nt)) break;
            const nextVers = extractVersionedEntityAnchors(nt);
            if (nextVers.length > 0 && nextVers.some(v => verifiedVerAnchors.has(v))) break;
            const nextIsBullet = /^\s*(?:[-*•]|\d+\.)\s+/.test(rawNext);
            const nextIndent = (rawNext.match(/^\s*/) || [''])[0].length;
            if (isTopBullet) {
              // Only skip deeper-indented sub-bullets belonging to this bullet
              if (nextIndent > curIndent) { j++; continue; }
              break;
            } else {
              // Parent prose paragraph was ungrounded: skip its child bullets
              if (nextIsBullet) { j++; continue; }
              break;
            }
          }
          i = j - 1;
          continue;
        }

        // C2. Unverified calendar date assertion
        if (pDates.length > 0) {
          const unsupportedDates = pDates.filter(dc => !isDateSupported(dc, trimmed));
          if (unsupportedDates.length > 0) {
            const hasSupportedVer = pVers.length > 0 && pVers.some(v => verifiedVerAnchors.has(v));
            const inv = computeInvariantSupport(trimmed);
            const { bestSim, bestDoc } = computeMaxDocSimilarity(trimmed);

            if ((hasSupportedVer || inv.ratio >= 0.5 || bestSim >= 0.25) && bestDoc && bestDoc.ts !== null) {
              // Entity/event IS grounded in bestDoc, project fabricated date onto verified timestamp
              const dt = new Date(bestDoc.ts);
              const trueDateStr = `${dt.getUTCDate()} ${ID_MONTH_NAMES[dt.getUTCMonth() + 1]} ${dt.getUTCFullYear()}`;
              for (const badDc of unsupportedDates) {
                if (badDc.raw) {
                  line = line.replace(badDc.raw, trueDateStr);
                  dateCorrections++;
                }
              }
            } else {
              // Neither date nor entity/invariant is grounded in E -> prune fabricated claim!
              prunedCount++;
              continue;
            }
          }
        }
      }

      projectedLines.push(line);
    }

    // 3. Clean up empty Markdown tables (header + separator with 0 remaining data rows) & orphaned headings
    const cleanedLines = [];
    for (let i = 0; i < projectedLines.length; i++) {
      const cur = projectedLines[i].trim();
      const nxt = (projectedLines[i + 1] || '').trim();
      const nxt2 = (projectedLines[i + 2] || '').trim();
      if (/^\|.*\|$/.test(cur) && /^\|[\s:|-]+\|$/.test(nxt) && !/^\|.*\|$/.test(nxt2)) {
        // Table lost all its ungrounded rows -> skip header & separator
        i += 1;
        continue;
      }
      cleanedLines.push(projectedLines[i]);
    }

    // Remove headings that became completely empty (followed immediately by another heading of same/higher level or EOF)
    const finalLines = [];
    for (let i = 0; i < cleanedLines.length; i++) {
      const cur = cleanedLines[i].trim();
      if (/^#{1,4}\s+/.test(cur)) {
        const curLevel = (cur.match(/^#+/) || [''])[0].length;
        let k = i + 1;
        while (k < cleanedLines.length && (!cleanedLines[k].trim() || /^---+$/.test(cleanedLines[k].trim()))) k++;
        if (k >= cleanedLines.length) continue;
        const nextNonEmpty = cleanedLines[k].trim();
        if (/^#{1,4}\s+/.test(nextNonEmpty)) {
          const nextLevel = (nextNonEmpty.match(/^#+/) || [''])[0].length;
          if (nextLevel <= curLevel) continue;
        }
      }
      finalLines.push(cleanedLines[i]);
    }

    const finalText = finalLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const hallucinationRate = evaluatedClaims > 0 ? (prunedCount / evaluatedClaims) : 0;

    return {
      text: finalText,
      prunedCount,
      dateCorrections,
      evaluatedClaims,
      hallucinationRate: Number(hallucinationRate.toFixed(4))
    };
  }

  // ============================================================================
  // 17. GERBANG INFORMASI SHANNON & DETEKSI KUERI AMBIGU / META-IMPERATIVE TANPA KONTEKS
  // Mencegah kolaps prior tanpa syarat saat kueri hanya berisi instruksi meta (misal "Jawab singkat saja")
  // atau merujuk ke media terlampir padahal tidak ada lampiran gambar/berkas (Dangling Media Deictic Query).
  // ============================================================================
  const DEICTIC_MEDIA_TOKENS = new Set([
    'gambar', 'gambarnya', 'foto', 'fotonya', 'image', 'images', 'photo', 'photos',
    'picture', 'pictures', 'screenshot', 'lampiran', 'terlampir', 'dilampirkan',
    'dokumen', 'file', 'pdf', 'diagram', 'grafik', 'skrinsut', 'isi', 'konten'
  ]);

  const META_IMPERATIVE_TOKENS = new Set([
    'jawab', 'jawablah', 'jawabannya', 'jawaban', 'singkat', 'saja', 'tolong', 'bantu', 'berikan', 'kasih',
    'apa', 'mana', 'cepat', 'ya', 'dong', 'ini', 'itu', 'deh', 'lah', 'kan', 'nih',
    'analisis', 'analisa', 'jelaskan', 'sebutkan', 'uraikan', 'baca', 'bacakan', 'cek', 'periksa',
    'simpulkan', 'terjemahkan', 'artikan', 'tuliskan', 'tulis',
    'answer', 'respond', 'reply', 'give', 'me', 'the', 'please', 'just', 'briefly', 'shortly', 'quick', 'only',
    'analyze', 'analysis', 'explain', 'read', 'check', 'summarize'
  ]);

  function isZeroInformationQuery(prompt, hasImages = false, hasHistory = false) {
    if (hasImages || hasHistory) return false;
    if (!prompt || typeof prompt !== 'string') return true;
    const words = prompt.toLowerCase().replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    const substantive = words.filter(w => !META_IMPERATIVE_TOKENS.has(w) && !DEICTIC_MEDIA_TOKENS.has(w));
    return substantive.length === 0;
  }

  return {
    isZeroInformationQuery,
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
    createEntropyStreamGate,
    parseAuthenticTimestamp,
    extractCalendarDateCoordinates,
    extractVersionedEntityAnchors,
    computeTemporalRecencyProfile,
    rankDocumentsMathematically,
    computeOptimalSamplingTemperature,
    projectGroundedResponseMathematically
  };
});
