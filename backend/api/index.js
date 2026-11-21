let app;
let loadError = null;

try {
  app = require('../src/server');
} catch (err) {
  loadError = err;
  console.error('CRITICAL LOAD ERROR:', err);
}

module.exports = (req, res) => {
  // Always set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-code');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (loadError) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      error: 'Backend failed to load on Vercel',
      message: loadError.message,
      stack: loadError.stack,
    });
  }

  try {
    return app(req, res);
  } catch (err) {
    console.error('RUNTIME ERROR:', err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({
      error: 'Backend runtime error on Vercel',
      message: err.message,
      stack: err.stack,
    });
  }
};
