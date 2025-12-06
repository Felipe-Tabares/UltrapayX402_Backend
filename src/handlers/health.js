/**
 * Health check endpoint
 */
async function healthHandler(req, res) {
  return res.status(200).json({
    status: 'ok',
    service: 'ultrapay-backend',
    timestamp: new Date().toISOString()
  });
}

module.exports = { healthHandler };
