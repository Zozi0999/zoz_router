module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-title, X-Title, http-referer, HTTP-Referer, x-session-id, X-Session-ID');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      sessions: [],
      stateless: true,
      message: 'Stateless serverless gateway mode — riwayat sesi dikelola via IndexedDB peramban.'
    });
  }

  return res.status(200).json({
    success: true,
    stateless: true,
    message: 'Stateless serverless gateway mode — riwayat sesi dikelola via IndexedDB peramban.'
  });
};
