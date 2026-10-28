const assert = require('assert');
const fs = require('fs');

console.log('=== SANDBOX INTEGRATION TEST: APP.JS PURE MATHEMATICAL DYCK CONTINUATION ===');

const appJs = fs.readFileSync('app.js', 'utf8');

// Helper to extract function by name from app.js
function extractFunction(name) {
  const rx = new RegExp(`function ${name}\\s*\\([\\s\\S]*?\\n  \\}`);
  const m = appJs.match(rx);
  assert.ok(m, `Function ${name} must exist in app.js`);
  return new Function('return ' + m[0])();
}

const computeDyckDeficitStack = extractFunction('computeDyckDeficitStack');
global.computeDyckDeficitStack = computeDyckDeficitStack;
const applyDyckAlgebraicClosure = extractFunction('applyDyckAlgebraicClosure');
global.applyDyckAlgebraicClosure = applyDyckAlgebraicClosure;
const stitchContinuationChunk = extractFunction('stitchContinuationChunk');
const isWebsiteComplete = extractFunction('isWebsiteComplete');

console.log('PASS: Successfully extracted all 4 functions directly from app.js');

// TEST 1: Tag Deficit Stack Calculation
console.log('\n--- TEST 1: Tag Deficit Stack Calculation ---');
const rawFragment = `<!DOCTYPE html><html><head><title>Test</title></head><body><div class="container"><main><section><h1>Judul</h1><p>Paragraf`;
const stack = computeDyckDeficitStack(rawFragment);
console.log('Calculated Deficit Stack:', stack);
assert.deepStrictEqual(stack, ['html', 'body', 'div', 'main', 'section', 'p']);
console.log('PASS: Dyck deficit stack correctly tracked 6 open tags in LIFO order');

// TEST 2: Dyck Algebraic Closure Synthesis
console.log('\n--- TEST 2: Dyck Algebraic Closure Synthesis ---');
const closed = applyDyckAlgebraicClosure(rawFragment);
const remainingDeficit = computeDyckDeficitStack(closed);
assert.strictEqual(remainingDeficit.length, 0, 'Deficit must be 0 after closure');
assert.ok(closed.includes('</p>\n</section>\n</main>\n</div>\n</body>\n</html>'), 'Tags must close in inverse LIFO order');
console.log('PASS: Dyck Algebraic Closure successfully sealed all unclosed tags.');

// TEST 3: Script & Style Closure with Nested Brackets
console.log('\n--- TEST 3: Script & Style Closure with Nested Brackets ---');
const unclosedScriptHtml = `<!DOCTYPE html><html><head><style>body { color: red; </style></head><body><script>function test() { if (true) { console.log("hi");`;
const closedScript = applyDyckAlgebraicClosure(unclosedScriptHtml);
assert.ok(closedScript.includes('}}'), 'Braces must be balanced');
assert.ok(closedScript.includes('</script>'), 'Script must be closed');
assert.ok(closedScript.includes('</html>'), 'Html must be closed');
console.log('PASS: Script brackets balanced and sealed cleanly.');

// TEST 4: Anti-Wipeout Continuation Stitching
console.log('\n--- TEST 4: Anti-Wipeout Continuation Stitching ---');
const base500Lines = `<<<ZOZ_FILE name="index.html" lang="html">
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Website Bisnis Modern</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <!-- 500 lines of base code simulated -->
  <header><h1>Header Keren</h1></header>
  <main><div class="hero"><h2>Selamat Datang</h2></div>`;

const chunkWithDuplicateZoz = `<<<ZOZ_FILE name="index.html" lang="html">
    <section class="features">
      <div class="feature-card">Fitur 1</div>
      <div class="feature-card">Fitur 2</div>
    </section>
  </main>
  <footer><p>&copy; 2026 Bisnis</p></footer>
</body>
</html>
<<<END_ZOZ_FILE>>>`;

const stitched = stitchContinuationChunk(base500Lines, chunkWithDuplicateZoz);
assert.ok(stitched.includes('Header Keren'), 'Base header MUST NOT be wiped out!');
assert.ok(stitched.includes('<!DOCTYPE html>'), 'Base doctype MUST NOT be wiped out!');
assert.ok(stitched.includes('Fitur 1'), 'Continuation chunk features MUST be stitched!');
assert.ok(stitched.includes('<<<END_ZOZ_FILE>>>'), 'Ending marker MUST be preserved!');
assert.strictEqual(isWebsiteComplete(stitched, stitched), true, 'Stitched result MUST pass isWebsiteComplete!');
console.log('PASS: Base preserved 100%, duplicate header stripped, and closure validated.');

// TEST 5: isOutputTruncated without ReferenceError
console.log('\n--- TEST 5: isOutputTruncated Reference Check ---');
const isOutputTruncatedRx = /function isOutputTruncated\([\s\S]*?\n  \}/;
const isOutputTruncatedMatch = appJs.match(isOutputTruncatedRx);
assert.ok(isOutputTruncatedMatch, 'isOutputTruncated must exist');
const isOutputTruncated = new Function('splitReasoningAndContent', 'isWebsiteComplete', 'return ' + isOutputTruncatedMatch[0])(
  (t) => ({ reasoning: '', content: t }),
  isWebsiteComplete
);

const truncatedTestText = `<!DOCTYPE html><html><body><h1>Halo`;
const isTruncated = isOutputTruncated(truncatedTestText);
assert.strictEqual(isTruncated, true, 'Unfinished HTML must be detected as truncated');
console.log('PASS: isOutputTruncated executed cleanly without ReferenceError.');

console.log('\n=== ALL 5 SANDBOX INTEGRATION TESTS PASSED 100%! === 🎉');
