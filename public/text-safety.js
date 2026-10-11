(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ZozTextSafety = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const OPEN_TAG = '<think>';
  const CLOSE_TAG = '</think>';
  const REASONING_KEYS = new Set([
    'reasoning', 'reasoning_content', 'reasoning_details', 'thought', 'thinking', 'thoughts'
  ]);

  function splitReasoningAndContent(rawText) {
    if (typeof rawText !== 'string' || !rawText) {
      return { reasoning: '', content: '', isThinking: false };
    }
    let reasoning = '';
    let content = '';
    let cursor = 0;
    let isThinking = false;
    const lower = rawText.toLowerCase();
    while (cursor < rawText.length) {
      const open = lower.indexOf(OPEN_TAG, cursor);
      if (open < 0) {
        content += rawText.slice(cursor);
        break;
      }
      content += rawText.slice(cursor, open);
      const bodyStart = open + OPEN_TAG.length;
      const close = lower.indexOf(CLOSE_TAG, bodyStart);
      if (close < 0) {
        reasoning += rawText.slice(bodyStart);
        isThinking = true;
        break;
      }
      reasoning += rawText.slice(bodyStart, close);
      cursor = close + CLOSE_TAG.length;
    }
    // Reasoning text is never guessed/promoted into the user-visible answer.
    return { reasoning: reasoning.trim(), content: content.trim(), isThinking };
  }

  function stripReasoningText(rawText) {
    return splitReasoningAndContent(rawText).content;
  }

  function reflowShreddedProse(text) {
    // Preserve authored formatting instead of broadly rewriting Markdown.
    return typeof text === 'string' ? text : '';
  }

  function createThinkTagStripper() {
    let inside = false;
    let pending = '';

    function suffixThatCouldStartTag(text, tag) {
      const max = Math.min(text.length, tag.length - 1);
      for (let n = max; n > 0; n--) {
        if (text.slice(-n).toLowerCase() === tag.slice(0, n)) return n;
      }
      return 0;
    }

    function push(text, final = false) {
      const input = pending + String(text || '');
      pending = '';
      let output = '';
      let pos = 0;
      while (pos < input.length) {
        const lower = input.toLowerCase();
        if (inside) {
          const close = lower.indexOf(CLOSE_TAG, pos);
          if (close < 0) {
            const tail = input.slice(pos);
            const keep = final ? 0 : suffixThatCouldStartTag(tail, CLOSE_TAG);
            if (keep) pending = tail.slice(-keep);
            break;
          }
          pos = close + CLOSE_TAG.length;
          inside = false;
          continue;
        }
        const open = lower.indexOf(OPEN_TAG, pos);
        if (open < 0) {
          const tail = input.slice(pos);
          const keep = final ? 0 : suffixThatCouldStartTag(tail, OPEN_TAG);
          output += keep ? tail.slice(0, -keep) : tail;
          if (keep) pending = tail.slice(-keep);
          break;
        }
        output += input.slice(pos, open);
        pos = open + OPEN_TAG.length;
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
      if (REASONING_KEYS.has(key.toLowerCase())) continue;
      if ((key === 'content' || key === 'response' || key === 'text') && typeof value === 'string') {
        const id = key + ':' + (record.index ?? record.id ?? record.model ?? 'default');
        if (!tagStrippers.has(id)) tagStrippers.set(id, createThinkTagStripper());
        out[key] = tagStrippers.get(id).push(value);
      } else if ((key === 'content' || key === 'response') && Array.isArray(value)) {
        out[key] = value.map((part, index) => {
          if (part && typeof part === 'object' && typeof part.text === 'string') {
            const id = `part:${record.index ?? record.id ?? 'default'}:${index}`;
            if (!tagStrippers.has(id)) tagStrippers.set(id, createThinkTagStripper());
            const cleanPart = { ...part, text: tagStrippers.get(id).push(part.text) };
            for (const reasoningKey of REASONING_KEYS) delete cleanPart[reasoningKey];
            return cleanPart;
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
        // Drop malformed frames rather than forwarding potentially unsafe text.
        return '';
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
