const assert = require('assert');
const fs = require('fs');

console.log('--- TEST 0: Verify isWebsiteComplete extraction directly from app.js ---');
const appJsCode = fs.readFileSync('app.js', 'utf8');
const fnMatch = appJsCode.match(/function isWebsiteComplete\([\s\S]*?\n  \}/);
assert.ok(fnMatch, 'isWebsiteComplete must exist in app.js');
const isWebsiteCompleteFromAppJs = new Function('return ' + fnMatch[0])();
assert.strictEqual(typeof isWebsiteCompleteFromAppJs, 'function', 'isWebsiteComplete must be a valid executable function');
console.log('PASS: isWebsiteComplete successfully parsed directly from app.js.');

const isWebsiteComplete = isWebsiteCompleteFromAppJs;

console.log('--- TEST 1: Complete HTML document ---');
const completeHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Website Keren</title>
  <style>body { font-family: sans-serif; }</style>
</head>
<body>
  <header><h1>Selamat Datang</h1></header>
  <main><section><p>Ini adalah konten website lengkap dengan desain modern dan responsif untuk portofolio atau bisnis.</p></section></main>
  <footer><p>&copy; 2026 Zoz Router</p></footer>
  <script>console.log("Ready");</script>
</body>
</html>`;
assert.strictEqual(isWebsiteComplete(completeHtml), true, 'Complete HTML should pass validation');
console.log('PASS: Complete HTML is valid.');

console.log('--- TEST 2: Truncated HTML without </body></html> ---');
const truncatedHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Website Keren</title>
</head>
<body>
  <header><h1>Selamat Datang</h1></header>
  <div class="content">
    <p>Ini adalah konten...`;
assert.strictEqual(isWebsiteComplete(truncatedHtml), false, 'Truncated HTML should be invalid');
console.log('PASS: Truncated HTML is correctly flagged as incomplete.');

console.log('--- TEST 3: Fake auto-closed HTML with unclosed <script> ---');
const fakeClosedScriptHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <title>Website Keren</title>
</head>
<body>
  <div class="hero"><h1>Judul</h1><p>Deskripsi panjang yang menarik untuk website bisnis modern.</p></div>
  <script>
    function setup() {
      const a = 10;
</html>`;
assert.strictEqual(isWebsiteComplete(fakeClosedScriptHtml), false, 'Unclosed script should be invalid');
console.log('PASS: Unclosed script with fake </html> is correctly flagged as incomplete.');

console.log('--- TEST 4: HTML with unclosed ZOZ_FILE block ---');
const unclosedZozBlock = `<<<ZOZ_FILE name="index.html" lang="html">
${completeHtml}`;
assert.strictEqual(isWebsiteComplete(completeHtml, unclosedZozBlock), false, 'Unclosed ZOZ_FILE should be invalid');
console.log('PASS: Unclosed ZOZ_FILE is correctly flagged as incomplete.');

console.log('--- TEST 5: HTML with lazy placeholder comments ---');
const lazyHtml = `<!DOCTYPE html>
<html lang="id">
<head><title>Web</title></head>
<body>
  <div class="hero"><h1>Judul</h1><p>Deskripsi panjang yang menarik untuk website bisnis modern.</p></div>
  <!-- sisa kode lanjutkan disini... -->
</body>
</html>`;
assert.strictEqual(isWebsiteComplete(lazyHtml), false, 'Lazy placeholder should be invalid');
console.log('PASS: Lazy placeholder comment is correctly flagged as incomplete.');

console.log('--- TEST 6: HTML cut off inside a tag (<button on) before </html> ---');
const cutOffTagHtml = `<!DOCTYPE html>
<html lang="id">
<head><title>Web</title></head>
<body>
  <div class="hero"><h1>Judul</h1><p>Deskripsi panjang yang menarik untuk website bisnis modern.</p></div>
  <button on
</body>
</html>`;
assert.strictEqual(isWebsiteComplete(cutOffTagHtml), false, 'Cut off tag in flight should be invalid');
console.log('PASS: Cut off tag in flight is correctly flagged as incomplete.');

console.log('--- TEST 7: Complete HTML with script containing < and > operators ---');
const scriptWithComparisonsHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Website Dengan JS Logic</title>
</head>
<body>
  <div class="card"><h2>Counter</h2><p id="cnt">0</p><button id="btn">Click</button></div>
  <script>
    const x = 5;
    if (x < 10 && x > 2) {
      console.log('in range');
    }
  </script>
</body>
</html>`;
assert.strictEqual(isWebsiteComplete(scriptWithComparisonsHtml), true, 'Script with < comparisons should be valid');
console.log('PASS: Complete HTML with script operators is valid.');

console.log('--- TEST 8: Auto-Continuation Stitching Flow ---');
function stitchContinuationChunk(existingText, newChunk) {
  if (!newChunk) return existingText;
  let chunk = newChunk;
  // Strip duplicate opening tags if model repeats
  const existingTrim = existingText.trimEnd();
  const chunkTrim = chunk.trimStart();
  const maxOverlapCheck = Math.min(120, existingTrim.length, chunkTrim.length);
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
  const endsWithWhitespace = /\s$/.test(existingText);
  const startsWithWhitespace = /^\s/.test(chunk);
  let sep = '';
  if (!existingText.endsWith('\n') && !chunk.startsWith('\n')) {
    sep = (endsWithWhitespace || startsWithWhitespace) ? '' : '\n';
  }
  return existingText + sep + chunk;
}

const part1 = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Toko Online Modern</title>
</head>
<body>
  <header><h1>Toko Online Modern</h1></header>
  <main>
    <div class="product-grid">
      <div class="card"><h3>Produk 1</h3><p>Harga Rp 100.000</p></div>`;

assert.strictEqual(isWebsiteComplete(part1), false, 'Part 1 alone is incomplete');

const part2 = `      <div class="card"><h3>Produk 2</h3><p>Harga Rp 200.000</p></div>
    </div>
  </main>
  <footer><p>&copy; 2026 Toko Modern</p></footer>
  <script>console.log("App ready");</script>
</body>
</html>`;

const stitched = stitchContinuationChunk(part1, part2);
assert.strictEqual(isWebsiteComplete(stitched), true, 'Stitched continuation must pass isWebsiteComplete');
console.log('PASS: Multi-round continuation stitching successfully produces complete website.');

console.log('--- TEST 9: Honest TaskTracker Completion Status ---');
const mockTasks = [
  { id: '1', subject: 'Rancang website toko online', status: 'in_progress', activeForm: 'Sedang merancang...' }
];

// Simulated incomplete run
const isCompleteIncompleteRun = isWebsiteComplete(part1);
if (isCompleteIncompleteRun) {
  mockTasks.forEach(t => { if (t.status === 'in_progress') { t.status = 'completed'; t.activeForm = 'Selesai'; } });
}
assert.strictEqual(mockTasks[0].status, 'in_progress', 'Task must stay in_progress when website is incomplete');
console.log('PASS: TaskTracker stays in_progress when website is incomplete.');

// Simulated complete run after continuation
const isCompleteFinishedRun = isWebsiteComplete(stitched);
if (isCompleteFinishedRun) {
  mockTasks.forEach(t => { if (t.status === 'in_progress') { t.status = 'completed'; t.activeForm = 'Selesai'; } });
}
assert.strictEqual(mockTasks[0].status, 'completed', 'Task must be marked completed only when website is complete');
console.log('PASS: TaskTracker is marked completed only when website is truly complete.');

console.log('\nALL 9 COMPLETION & TASK TRACKER TESTS PASSED SUCCESSFULLY! 🎉');
