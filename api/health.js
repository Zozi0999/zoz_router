module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return res.status(200).json({
    status: 'online',
    name: 'Zoz Router Serverless Gateway',
    version: '1.0.0',
    storage: 'cloud-stateless',
    timestamp: new Date().toISOString()
  });
};
