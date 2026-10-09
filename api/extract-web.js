// ============================================================================
// Vercel Serverless Function: Web Page Content Extractor / Reader Tool
// Mengekstrak teks artikel bersih dari URL publik untuk dibaca dan diringkas oleh AI
// ============================================================================

function isPrivateIpOrHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return true;
  const host = hostname.toLowerCase().trim();
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
  if (/^169\.254\.\d+\.\d+$/.test(host)) return true; // Cloud metadata
  return false;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    let targetUrl = '';
    let maxChars = 8000;

    if (req.method === 'GET') {
      targetUrl = req.query?.url || req.query?.link || '';
      if (req.query?.maxChars) maxChars = parseInt(req.query.maxChars, 10) || 8000;
    } else {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) {}
      }
      body = body || {};
      targetUrl = body.url || body.link || '';
      if (body.maxChars) maxChars = parseInt(body.maxChars, 10) || 8000;
    }

    if (!targetUrl || !targetUrl.trim()) {
      return res.status(400).json({ success: false, error: 'Parameter url diperlukan.' });
    }

    let clean = targetUrl.trim();
    if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`;

    let parsedUrl;
    try {
      parsedUrl = new URL(clean);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Format URL tidak valid: ' + e.message });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ success: false, error: 'Protokol URL harus http atau https.' });
    }

    if (isPrivateIpOrHost(parsedUrl.hostname)) {
      return res.status(400).json({ success: false, error: 'Akses ke host privat/lokal diblokir (SSRF Protection).' });
    }

    const response = await fetch(parsedUrl.href, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!response.ok) {
      return res.status(200).json({
        success: false,
        url: clean,
        domain: parsedUrl.hostname,
        error: `Server situs web mengembalikan status HTTP ${response.status} (${response.statusText})`
      });
    }

    const html = await response.text();

    // Ekstraksi Title
    const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
    title = title
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Pembersihan Tag HTML
    let text = html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<aside\b[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<form\b[\s\S]*?<\/form>/gi, ' ')
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ');

    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text || text.length < 50) {
      return res.status(200).json({
        success: false,
        url: clean,
        domain: parsedUrl.hostname,
        title: title || parsedUrl.hostname,
        error: 'Tidak ditemukan konten teks yang cukup pada halaman web ini (mungkin memerlukan JavaScript rendering).'
      });
    }

    const truncated = text.substring(0, Math.min(maxChars, 15000));

    return res.status(200).json({
      success: true,
      url: clean,
      domain: parsedUrl.hostname,
      title: title || parsedUrl.hostname,
      charCount: truncated.length,
      content: truncated,
      extractedAt: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Gagal mengekstrak website: ' + err.message
    });
  }
};
