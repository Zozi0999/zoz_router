/**
 * Jozz Memory - Privacy & Anti-Inference Guardrails
 * Strict PII/Secret Redaction & Explicit Fact Enforcer
 */

const PII_PATTERNS = [
  // 1. API Keys & Bearer Tokens
  {
    name: 'OPENAI_KEY',
    regex: /\bsk-(?:proj-|live-)?[a-zA-Z0-9_-]{20,}\b/g,
    placeholder: '[REDACTED_API_KEY]'
  },
  {
    name: 'ANTHROPIC_KEY',
    regex: /\bsk-ant-[a-zA-Z0-9_-]{20,}\b/g,
    placeholder: '[REDACTED_API_KEY]'
  },
  {
    name: 'GITHUB_PAT',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}\b/g,
    placeholder: '[REDACTED_API_KEY]'
  },
  {
    name: 'AWS_ACCESS_KEY',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    placeholder: '[REDACTED_AWS_KEY]'
  },
  {
    name: 'GENERIC_SECRET_TOKEN',
    regex: /(?:api[_-]?key|secret[_-]?token|bearer\s+|auth[_-]?token)[\s:=]+['"]?([a-zA-Z0-9_\-\.]{24,})['"]?/gi,
    replaceFn: (match, token) => match.replace(token, '[REDACTED_SECRET]')
  },

  // 2. Passwords in Key-Value Pairs
  {
    name: 'PASSWORD_ASSIGNMENT',
    regex: /(?:password|passwd|kata\s*sandi|pin\s*atm)[\s:=]+['"]?([^'"\s,;]{4,})['"]?/gi,
    replaceFn: (match, p) => match.replace(p, '[REDACTED_PASSWORD]')
  },

  // 3. Credit / Debit Cards (13 to 19 digits)
  {
    name: 'CREDIT_CARD',
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|(?:[0-9]{4}[-\s]){3}[0-9]{4})\b/g,
    placeholder: '[REDACTED_CARD_NUMBER]'
  },

  // 4. Indonesian NIK (Nomor Induk Kependudukan - 16 digit) & US SSN (9 digit)
  {
    name: 'INDONESIA_NIK',
    regex: /\b[1-9][0-9]{15}\b/g,
    placeholder: '[REDACTED_NIK]'
  },
  {
    name: 'US_SSN',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    placeholder: '[REDACTED_SSN]'
  },

  // 5. Bank Account Numbers in Banking Context
  {
    name: 'BANK_ACCOUNT',
    regex: /(?:rekening(?:\s*bank)?|no\.?\s*rek|account\s*number|norek)[\s:=]+['"]?([0-9]{8,18})['"]?/gi,
    replaceFn: (match, acc) => match.replace(acc, '[REDACTED_BANK_ACCOUNT]')
  }
];

// Anti-Inference Markers: AI guessing or hallucinating facts not stated by user
const SPECULATIVE_PATTERNS = [
  /\b(?:mungkin\s+pengguna|sepertinya\s+pengguna|tampaknya\s+user|saya\s+menduga|asumsi\s*:|kemungkinan\s+besar\s+user|bisa\s+jadi\s+pengguna)\b/i,
  /\b(?:user\s+probably|user\s+might|assuming\s+that|i\s+guess\s+user|seems\s+like\s+user|hypothetically)\b/i
];

/**
 * Scan and redact sensitive PII or credentials
 */
function redactPII(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;

  for (const p of PII_PATTERNS) {
    if (typeof p.replaceFn === 'function') {
      cleaned = cleaned.replace(p.regex, p.replaceFn);
    } else if (p.placeholder) {
      cleaned = cleaned.replace(p.regex, p.placeholder);
    }
  }

  return cleaned;
}

/**
 * Check if a proposed memory candidate is speculative or inferential
 */
function validateAntiInference(factText) {
  if (!factText || typeof factText !== 'string') return { valid: false, reason: 'Teks fakta kosong' };
  const trimmed = factText.trim();
  if (trimmed.length < 5) return { valid: false, reason: 'Teks terlalu pendek' };

  for (const pattern of SPECULATIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        reason: 'Melanggar Guardrail Anti-Inferensi: Mengandung tebakan atau asumsi spekulatif.'
      };
    }
  }

  return { valid: true };
}

/**
 * Full sanitization pipeline for ingestion
 */
function sanitizeFactCandidate(rawText) {
  const inferenceCheck = validateAntiInference(rawText);
  if (!inferenceCheck.valid) {
    return {
      accepted: false,
      reason: inferenceCheck.reason,
      content: ''
    };
  }

  const redacted = redactPII(rawText).trim();
  return {
    accepted: true,
    content: redacted
  };
}

module.exports = {
  PII_PATTERNS,
  redactPII,
  validateAntiInference,
  sanitizeFactCandidate
};
