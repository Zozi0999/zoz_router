const assert = require('assert');

// 1. Pure Mathematical Dyck Deficit Stack Analyzer
function computeDyckDeficitStack(html) {
  const containerTags = ['div', 'section', 'article', 'aside', 'main', 'header', 'footer', 'nav', 'ul', 'ol', 'table', 'form', 'p', 'span', 'button', 'body', 'html'];
  const clean = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<<<[\s\S]*?>>>/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

  const tagRegex = /<\/?([a-zA-Z0-9_-]+)(?:\s+[^>]*?)?(\/?)>/g;
  const stack = [];
  let m;
  while ((m = tagRegex.exec(clean)) !== null) {
    const isClose = m[0].startsWith('</');
    const isSelfClose = m[2] === '/' || m[0].endsWith('/>');
    const tag = m[1].toLowerCase();
    if (!containerTags.includes(tag) || isSelfClose) continue;

    if (!isClose) {
      stack.push(tag);
    } else {
      const idx = stack.lastIndexOf(tag);
      if (idx !== -1) {
        stack.splice(idx, 1);
      }
    }
  }
  return stack;
}

// 2. Pure Mathematical Dyck Algebraic Closure Finalizer
function applyDyckAlgebraicClosure(html) {
  if (!html || typeof html !== 'string') return '';
  let code = html.trim();

  // A. Pastikan <script> dan <style> tertutup
  if (code.includes('<script') && !code.includes('</script>')) {
    const lastScriptIdx = code.toLowerCase().lastIndexOf('<script');
    let scriptBody = code.slice(lastScriptIdx);
    const openCurly = (scriptBody.match(/\{/g) || []).length;
    const closeCurly = (scriptBody.match(/\}/g) || []).length;
    if (openCurly > closeCurly) code += '\n' + '}'.repeat(openCurly - closeCurly);
    const openParen = (scriptBody.match(/\(/g) || []).length;
    const closeParen = (scriptBody.match(/\)/g) || []).length;
    if (openParen > closeParen) code += ')'.repeat(openParen - closeParen);
    code += '\n</script>';
  }
  if (code.includes('<style') && !code.includes('</style>')) {
    code += '\n</style>';
  }

  // B. Hitung Deficit Stack Dyck
  const stack = computeDyckDeficitStack(code);
  const toClose = stack.filter(t => t !== 'body' && t !== 'html').reverse();
  if (toClose.length > 0) {
    const closeStr = toClose.map(t => '\n</' + t + '>').join('');
    if (/<\/body\s*>/i.test(code)) {
      code = code.replace(/<\/body\s*>/i, closeStr + '\n</body>');
    } else {
      code += closeStr;
    }
  }

  // C. Pastikan </body> dan </html> tertutup
  if (!/<\/body\s*>/i.test(code) && /<body[\s>]/i.test(code)) {
    code += '\n</body>';
  }
  if (!/<\/html\s*>/i.test(code)) {
    code += '\n</html>';
  }
  if (code.includes('<<<ZOZ_FILE') && !code.includes('<<<END_ZOZ_FILE')) {
    code += '\n<<<END_ZOZ_FILE>>>';
  }

  return code;
}

// 3. Upgraded Robust isWebsiteComplete
function isWebsiteComplete(content, fullText = '', options = {}) {
  if (!content || typeof content !== 'string') return false;
  const trimmed = content.trim();
  if (trimmed.length < 150) return false;

  // 1. Tag dokumen HTML5 utama
  const hasDocTypeOrHtml = /<!DOCTYPE\s+html|<html\b/i.test(trimmed);
  const hasOpeningBody = /<body\b/i.test(trimmed);
  const hasClosingBody = /<\/body\s*>/i.test(trimmed);
  const hasClosingHtml = /<\/html\s*>/i.test(trimmed);

  if (!hasDocTypeOrHtml || !hasClosingHtml || !hasOpeningBody || !hasClosingBody) {
    return false;
  }

  // 2. Posisi penutup: </html> harus berada setelah </body>
  const bodyCloseIdx = trimmed.toLowerCase().lastIndexOf('</body>');
  const htmlCloseIdx = trimmed.toLowerCase().lastIndexOf('</html>');
  if (htmlCloseIdx <= bodyCloseIdx) {
    return false;
  }

  // 3. Keseimbangan pasangan tag <script> dan </script>
  const scriptOpenMatches = (trimmed.match(/<script\b[^>]*>/gi) || []).length;
  const scriptCloseMatches = (trimmed.match(/<\/script\s*>/gi) || []).length;
  if (scriptOpenMatches !== scriptCloseMatches) {
    return false;
  }

  // 4. Keseimbangan pasangan tag <style> dan </style>
  const styleOpenMatches = (trimmed.match(/<style\b[^>]*>/gi) || []).length;
  const styleCloseMatches = (trimmed.match(/<\/style\s*>/gi) || []).length;
  if (styleOpenMatches !== styleCloseMatches) {
    return false;
  }

  // 5. Cek tag yang terputus di tengah jalan (strip comments, zoz markers, scripts, styles)
  const cleanDom = trimmed
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<<<[\s\S]*?>>>/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

  let inAngle = false;
  for (let i = 0; i < cleanDom.length; i++) {
    const ch = cleanDom[i];
    if (ch === '<') {
      if (inAngle) return false;
      inAngle = true;
    } else if (ch === '>') {
      inAngle = false;
    }
  }
  if (inAngle) return false;

  // 6. Pasangan marker blok berkas (<<<ZOZ_FILE ... >>>)
  const combined = (fullText ? fullText + '\n' : '') + trimmed;
  if (combined.includes('<<<ZOZ_FILE')) {
    const fileStarts = (combined.match(/<<<ZOZ_(?:FILE|EDIT|MODIFY)/g) || []).length;
    const fileEnds = (combined.match(/<<<END_ZOZ_(?:FILE|EDIT|MODIFY)/g) || []).length;
    if (fileStarts > fileEnds) {
      return false;
    }
  }

  // 7. Pasangan markdown fence jika dipakai
  if (combined.includes('```html') || combined.includes('```htm')) {
    const backtickCount = (combined.match(/```/g) || []).length;
    if (backtickCount % 2 !== 0) {
      return false;
    }
  }

  // 8. Deteksi Zero-Lazy & placeholder terpotong
  const lazyPlaceholders = [
    /<!--\s*(?:sisa\s+kode|rest\s+of\s+code|lanjutkan|tambahkan\s+sisa|to\s*be\s*continued|todo:?\s*add)\b/i,
    /\/\*\s*(?:sisa\s+kode|rest\s+of\s+code|lanjutkan|tambahkan\s+sisa|insert\s+code\s+here)\b/i,
    /\/\/\s*(?:sisa\s+kode|rest\s+of\s+code|lanjutkan\s+disini|insert\s+code\s+here)\b/i
  ];
  if (lazyPlaceholders.some(rx => rx.test(trimmed))) {
    return false;
  }

  // 9. Validasi substansi DOM (harus ada konten visual DOM nyata di dalam body)
  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(trimmed);
  if (bodyMatch) {
    const bodyInner = bodyMatch[1].trim();
    const visualDom = bodyInner.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '').trim();
    if (visualDom.length < 50) {
      return false;
    }
  }

  return true;
}

// 4. Pure Mathematical stitchContinuationChunk:
function stitchContinuationChunkPure(existingText, incomingChunk) {
  if (!incomingChunk || typeof incomingChunk !== 'string') return existingText || '';
  if (!existingText || typeof existingText !== 'string') return incomingChunk;

  let chunk = incomingChunk.trim();

  // 1. Strip conversational chatter
  chunk = chunk.replace(/^(?:[\s\r\n]*)(?:tentu|baik(?:lah)?|pasti|oke|siap|berikut(?:nya)?|ini(?:lah)?|lanjutan|kelanjutan|sambungan|melanjutkan)[^\n]*\n+/i, '');
  chunk = chunk.replace(/^(?:[\s\r\n]*)(?:here\s+is\s+the\s+continuation|continuing\s+the\s+code|continuation|continued)[^\n]*\n+/i, '');

  // 2. Strip redundant markdown code fences
  chunk = chunk.replace(/^```[a-zA-Z0-9_-]*\s*\n?/i, '');
  chunk = chunk.replace(/\n?```\s*$/i, '');

  // 3. Strip redundant <<<ZOZ_FILE...>>> headers from continuation chunk (ANTI-WIPEOUT)
  chunk = chunk.replace(/^<<<ZOZ_(?:FILE|EDIT|MODIFY)[^\n>]*>\s*\n?/i, '');

  // Hanya jika chunk adalah DOKUMEN LENGKAP UTUH dari awal (ada <!DOCTYPE, <head, <body, dan </html>)
  // dan ukurannya setara/lebih besar dari draf saat ini, barulah ganti dokumen utuh
  const isChunkTrueFullDocument = /<!DOCTYPE\s+html/i.test(chunk) && /<head\b/i.test(chunk) && /<body\b/i.test(chunk) && /<\/html>/i.test(chunk);
  if (isChunkTrueFullDocument && chunk.length >= existingText.length * 0.85) {
    return chunk;
  }

  // Jika chunk mengulang tag pembuka <!DOCTYPE html> atau <html> di awal tanpa <head>:
  chunk = chunk.replace(/^<!DOCTYPE\s+html[^>]*>\s*\n?/i, '');
  chunk = chunk.replace(/^<html\b[^>]*>\s*\n?/i, '');

  // 4. Bersihkan diff markers / chevrons liar (KECUALI <<<END_ZOZ_FILE>>> di ujung)
  const hasEndMarker = /<<<END_ZOZ_(?:FILE|EDIT|MODIFY)>>>?\s*$/i.test(chunk);
  chunk = chunk.replace(/(?:^|\n)\s*<{2,}\s*(?:SEARCH|REPLACE)?[^>\n]*>{0,}\s*(?=\n|$)/gi, '\n');
  chunk = chunk.replace(/(?:^|\n)\s*={3,}\s*(?=\n|$)/g, '\n');
  chunk = chunk.replace(/(?:^|\n)\s*>{2,}\s*(?:REPLACE)?[^>\n]*>{0,}\s*(?=\n|$)/gi, '\n');
  chunk = chunk.replace(/<{2,}>{1,}|<{1,}>{2,}/g, '');
  chunk = chunk.replace(/<<>>/g, '');

  // 5. Cegah 'SyntaxError: Identifier has already been declared' akibat redeclarations
  if (chunk && (existingText.includes('<script') || chunk.includes('<script'))) {
    const existingDecls = new Set();
    const declRegex = /\b(?:const|let)\s+([a-zA-Z0-9_$]+)\s*=/g;
    let m;
    while ((m = declRegex.exec(existingText)) !== null) {
      existingDecls.add(m[1]);
    }
    if (existingDecls.size > 0) {
      chunk = chunk.replace(/\b(const|let)\s+([a-zA-Z0-9_$]+)\s*=/g, (fullMatch, kw, id) => {
        if (existingDecls.has(id)) {
          return `${id} =`;
        }
        return fullMatch;
      });
    }
  }

  if (!chunk.trim()) return existingText;

  // 6. KMP & Suffix-Prefix Longest Overlap Detection (hingga 1200 karakter)
  const existingTrim = existingText.trimEnd();
  const chunkTrim = chunk.trimStart();

  const maxOverlapCheck = Math.min(1200, existingTrim.length, chunkTrim.length);
  let detectedOverlapLen = 0;
  for (let len = maxOverlapCheck; len >= 3; len--) {
    const tail = existingTrim.slice(-len);
    const head = chunkTrim.slice(0, len);
    if (tail === head) {
      detectedOverlapLen = len;
      break;
    }
  }

  if (detectedOverlapLen > 0) {
    chunk = chunkTrim.slice(detectedOverlapLen);
  }

  // 7. Deteksi overlap baris (fuzzy line matching untuk baris-baris tail)
  const existingLines = existingText.split('\n').map(l => l.trim()).filter(Boolean);
  const chunkLinesRaw = chunk.split('\n');
  let skipLines = 0;
  for (let i = 0; i < Math.min(15, chunkLinesRaw.length); i++) {
    const trimmedChunkLine = chunkLinesRaw[i].trim();
    if (!trimmedChunkLine) {
      skipLines = i + 1;
      continue;
    }
    const lastExistingTail = existingLines.slice(-10);
    if (lastExistingTail.includes(trimmedChunkLine)) {
      skipLines = i + 1;
    } else {
      break;
    }
  }
  if (skipLines > 0) {
    chunk = chunkLinesRaw.slice(skipLines).join('\n');
  }

  // 8. Tentukan pemisah sintaks
  const endsWithNewline = existingText.endsWith('\n');
  const startsWithNewline = chunk.startsWith('\n');
  const endsWithWhitespace = /\s$/.test(existingText);
  const startsWithWhitespace = /^\s/.test(chunk);

  let sep = '';
  if (!endsWithNewline && !startsWithNewline) {
    sep = (endsWithWhitespace || startsWithWhitespace) ? '' : '\n';
  }

  let result = existingText + sep + chunk;
  // Jika existingText diawali <<<ZOZ_FILE dan result sudah memuat </html> tapi belum ada penutup <<<END_ZOZ_FILE>>>:
  if (result.includes('<<<ZOZ_FILE') && !result.includes('<<<END_ZOZ_FILE') && result.includes('</html>')) {
    result += '\n<<<END_ZOZ_FILE>>>';
  }
  return result;
}

// ==================== TEST SUITE EXECUTION ====================

console.log('--- TEST 1: Dyck Deficit Stack Computation ---');
const testHtml = `<!DOCTYPE html><html><head><title>Test</title></head><body><main><section><div><p>Halo`;
const deficit = computeDyckDeficitStack(testHtml);
assert.deepStrictEqual(deficit, ['html', 'body', 'main', 'section', 'div', 'p']);
console.log('PASS: Deficit stack correctly identifies all 6 open tags in LIFO order.');

console.log('--- TEST 2: Dyck Algebraic Closure Sealed Document ---');
const sealed = applyDyckAlgebraicClosure(testHtml);
assert.strictEqual(computeDyckDeficitStack(sealed).length, 0, 'Deficit must be zero after closure');
assert.ok(sealed.includes('</p>\n</div>\n</section>\n</main>\n</body>\n</html>'), 'Tags must close in LIFO order');
console.log('PASS: Algebraic closure sealed all tags with Delta = 0.');

console.log('--- TEST 3: Anti-Wipeout Continuation Stitching ---');
const base = `<<<ZOZ_FILE name="index.html" lang="html">
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Toko Online Modern</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <header><h1>Toko Online</h1></header>
  <main>
    <div class="products">
      <div class="card">Produk 1</div>`;

const incomingChunkWithZoz = `<<<ZOZ_FILE name="index.html" lang="html">
      <div class="card">Produk 2</div>
    </div>
  </main>
  <footer>&copy; 2026</footer>
  <script>console.log("ready");</script>
</body>
</html>
<<<END_ZOZ_FILE>>>`;

const stitched = stitchContinuationChunkPure(base, incomingChunkWithZoz);
assert.ok(stitched.includes('<!DOCTYPE html>'), 'Base doctype must be preserved!');
assert.ok(stitched.includes('Produk 1'), 'Base content must NOT be wiped out!');
assert.ok(stitched.includes('Produk 2'), 'Continuation content must be stitched!');
assert.ok(stitched.includes('</html>'), 'Closing tags must be present!');
assert.strictEqual(isWebsiteComplete(stitched, stitched), true, 'Stitched result must pass isWebsiteComplete!');
console.log('PASS: Anti-wipeout stitching preserved base and created 100% complete document.');

console.log('--- TEST 4: Closure of Trailing Cutoff After Stitching ---');
const baseUnfinished = `<<<ZOZ_FILE name="index.html" lang="html">
<!DOCTYPE html>
<html lang="id">
<head><title>Portfolio</title></head>
<body>
  <header><h1>Nama Saya</h1></header>
  <main>
    <section class="bio"><p>Desainer Web Profesional yang siap membantu bisnis Anda berkembang secara digital.</p></section>
    <section class="contact"><div class="form-box">`;

const closedTail = applyDyckAlgebraicClosure(baseUnfinished);
assert.strictEqual(isWebsiteComplete(closedTail, closedTail), true, 'Closed tail must pass isWebsiteComplete!');
console.log('PASS: Incomplete website sealed directly via Dyck Algebraic Closure.');

console.log('\nALL MATHEMATICAL DYCK & STITCHING TESTS PASSED 100%! 🎉');
