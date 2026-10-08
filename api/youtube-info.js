module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    let targetUrl = '';
    if (req.method === 'GET') {
      targetUrl = req.query?.url || req.query?.link || '';
    } else {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) {}
      }
      body = body || {};
      targetUrl = body.url || body.link || '';
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
    const hostname = parsedUrl.hostname ? parsedUrl.hostname.toLowerCase() : '';
    const allowedHosts = ['youtu.be', 'www.youtu.be', 'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'];
    if (!allowedHosts.includes(hostname)) {
      return res.status(400).json({ success: false, error: 'Hanya URL YouTube resmi yang diizinkan.' });
    }

    let videoId = null;
    const match = parsedUrl.href.match(/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (match && match[1]) videoId = match[1];
    const canonicalUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : parsedUrl.href;

    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
    const ytRes = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });

    if (!ytRes.ok) {
      return res.status(200).json({
        success: false,
        videoId,
        url: canonicalUrl,
        error: `YouTube oEmbed HTTP ${ytRes.status}`
      });
    }

    const data = await ytRes.json();
    return res.status(200).json({
      success: true,
      url: canonicalUrl,
      videoId,
      title: data.title || 'Tanpa Judul',
      channel: data.author_name || 'Kreator YouTube',
      channel_url: data.author_url || '',
      thumbnail: data.thumbnail_url || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''),
      type: data.type || 'video',
      html: data.html || ''
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
