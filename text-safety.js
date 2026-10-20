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

  function stripReasoningText(rawText) {
    if (typeof rawText !== 'string' || !rawText) return '';
    return rawText
      .replace(THINKING_TAG_REGEX, '')
      .replace(BRACKET_THINK_REGEX, '')
      .replace(/<\/?(?:think|thought|thinking|reasoning|ant_thought|thought_process)\b[^>]*>/gi, '')
      .replace(/\[\/?(?:THOUGHT|REASONING)\]/gi, '')
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
      return output;
    }

    return { push };
  }

  function sanitizeRecord(record, tagStrippers) {
    if (Array.isArray(record)) return record.map(item => sanitizeRecord(item, tagStrippers));
    if (!record || typeof record !== 'object') return record;
    const out = {};
    for (const [key, value] of Object.entries(record)) {
      // Hapus kunci reasoning/thought agar pemikiran internal tidak bocor ke output klien/penyimpanan
      if (REASONING_KEYS.has(key.toLowerCase())) {
        continue;
      }
      if ((key === 'content' || key === 'response' || key === 'text') && typeof value === 'string') {
        const id = key + ':' + (record.index ?? record.id ?? record.model ?? 'default');
        if (!tagStrippers.has(id)) tagStrippers.set(id, createThinkTagStripper());
        out[key] = tagStrippers.get(id).push(value);
      } else if ((key === 'content' || key === 'response') && Array.isArray(value)) {
        out[key] = value.map((part, index) => {
          if (part && typeof part === 'object' && typeof part.text === 'string') {
            const id = `part:${record.index ?? record.id ?? 'default'}:${index}`;
            if (!tagStrippers.has(id)) tagStrippers.set(id, createThinkTagStripper());
            return { ...part, text: tagStrippers.get(id).push(part.text) };
          }
          return sanitizeRecord(part, tagStrippers);
        });
      } else if (value && typeof value === 'object') {
        out[key] = sanitizeRecord(value, tagStrippers);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  function createProviderStreamFilter(provider, mode = 'stream') {
    let buffer = '';
    const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
    const tagStrippers = new Map();
    const finishTagStrippers = () => {
      let tail = '';
      for (const stripper of tagStrippers.values()) tail += stripper.push('', true);
      tagStrippers.clear();
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
        const clean = sanitizeRecord(JSON.parse(raw), tagStrippers);
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
        if (payload === '[DONE]') return 'data: [DONE]' + eol;
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
      output += finishTagStrippers();
      return output;
    }

    return { push, end };
  }

  return {
    splitReasoningAndContent,
    stripReasoningText,
    reflowShreddedProse,
    createThinkTagStripper,
    createProviderStreamFilter
  };
});
