const express = require('express');
const serverless = require('serverless-http');
const { generateHandler } = require('./handlers/generate');
const { healthHandler } = require('./handlers/health');
const aiService = require('./services/ai');
const storageService = require('./services/storage');
const config = require('./config');
const { paymentMiddleware } = require('x402-express');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS para frontend - permitir headers de x402
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  // Headers que el cliente puede enviar (incluyendo los que x402-fetch usa)
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-payment, X-Payment, access-control-expose-headers');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  // Headers que el cliente puede leer de la respuesta 402
  res.header('Access-Control-Expose-Headers', 'x-payment, X-Payment');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware para logging de headers x-payment (debug)
app.use((req, res, next) => {
  if (req.headers['x-payment']) {
  }
  next();
});

// Configurar x402 middleware de forma sincrona
try {
  // Obtener proveedores para construir las rutas con precios
  const providers = aiService.getAvailableProviders();

  // Construir configuracion de rutas para x402
  const routeConfigs = {};

  // Precio minimo como base
  const minImagePrice = Math.min(...providers.filter(p => p.type === 'image').map(p => p.price));
  const minVideoPrice = Math.min(...providers.filter(p => p.type === 'video').map(p => p.price));
  const minPrice = Math.min(minImagePrice, minVideoPrice);

  // Configurar ruta /generate con precio base
  routeConfigs['POST /generate'] = {
    price: `$${minPrice}`, // Precio en USDC (debe incluir el símbolo $)
    network: config.x402.network
  };

  // Aplicar middleware x402 ANTES de definir las rutas
  app.use(paymentMiddleware(
    `${config.x402.walletAddress}`,
    routeConfigs,
    {
      url: config.x402.facilitatorUrl
    }
  ));
  
  console.log('x402 middleware configured successfully');
  console.log(`Wallet: ${config.x402.walletAddress}`);
  console.log(`Facilitator: ${config.x402.facilitatorUrl}`);
  console.log(`Network: ${config.x402.network}`);
  console.log(`Min Price: ${minPrice} USDC`);

} catch (error) {
  console.error('Error setting up x402 middleware:', error.message);
  console.log('Running without x402 middleware (payment verification will be simulated)');
}

// Routes publicas (sin pago)
app.get('/health', healthHandler);

app.get('/providers', (req, res) => {
  const { type } = req.query;

  let providers;
  if (type && ['image', 'video'].includes(type)) {
    providers = aiService.getProvidersByType(type);
  } else {
    providers = aiService.getAvailableProviders();
  }

  res.json({ providers });
});

app.get('/pricing', (req, res) => {
  const providers = aiService.getAvailableProviders();
  const imageProviders = providers.filter(p => p.type === 'image');
  const videoProviders = providers.filter(p => p.type === 'video');

  res.json({
    currency: 'USD',
    providers: providers.reduce((acc, p) => {
      acc[p.id] = p.price;
      return acc;
    }, {}),
    byType: {
      image: {
        min: Math.min(...imageProviders.map(p => p.price)),
        max: Math.max(...imageProviders.map(p => p.price)),
        providers: imageProviders
      },
      video: {
        min: Math.min(...videoProviders.map(p => p.price)),
        max: Math.max(...videoProviders.map(p => p.price)),
        providers: videoProviders
      }
    }
  });
});

// Ruta protegida con x402
app.post('/generate', generateHandler);

// Historial de transacciones por wallet
app.get('/history/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { limit } = req.query;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    const transactions = await storageService.getTransactionsByWallet(
      walletAddress,
      parseInt(limit) || 50
    );

    res.json({
      success: true,
      walletAddress: walletAddress.toLowerCase(),
      count: transactions.length,
      transactions
    });
  } catch (error) {
    console.error('[History] Error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Endpoint para compartir con meta tags de Twitter/Open Graph
app.get('/share/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const transaction = await storageService.getTransaction(transactionId);

    if (!transaction) {
      return res.status(404).send('Image not found');
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://ultrapayx402.netlify.app';
    const title = 'Imagen creada con UltraPayx402';
    const description = transaction.prompt.substring(0, 200) + (transaction.prompt.length > 200 ? '...' : '');
    const imageUrl = transaction.mediaUrl;

    // HTML con meta tags para Twitter Cards y Open Graph
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${frontendUrl}/share/${transactionId}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:site_name" content="UltraPayx402">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">

  <!-- Redirect to frontend -->
  <meta http-equiv="refresh" content="0;url=${frontendUrl}">
</head>
<body>
  <p>Redirigiendo a UltraPayx402...</p>
  <p><a href="${frontendUrl}">Click aqui si no eres redirigido</a></p>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('[Share] Error:', error);
    res.status(500).send('Error loading share page');
  }
});

// Toggle favorito de una transaccion
app.patch('/favorite/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { walletAddress } = req.body;

    if (!transactionId || !walletAddress) {
      return res.status(400).json({ error: 'transactionId and walletAddress are required' });
    }

    const result = await storageService.toggleFavorite(transactionId, walletAddress);

    if (!result.success) {
      return res.status(404).json({ error: result.error || 'Transaction not found' });
    }

    res.json({
      success: true,
      transactionId,
      isFavorite: result.isFavorite
    });
  } catch (error) {
    console.error('[Favorite] Error:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Middleware de manejo de errores x402
app.use((err, req, res, next) => {
  if (err) { 
    // Si el error ya fue manejado por x402, no hacer nada más
    if (res.headersSent) {
      return;
    }
    
    res.status(402).json({
      error: 'Payment verification failed',
      message: err.message
    });
  } else {
    next();
  }
});

// Export para Lambda (si se usa en AWS)
module.exports.handler = serverless(app);

// Export app
module.exports.app = app;

// Iniciar servidor solo si NO estamos en Lambda
// Lambda define AWS_LAMBDA_FUNCTION_NAME
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const PORT = process.env.PORT || 3005;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UltraPay Backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('Endpoints:');
    console.log('  GET  /health              - Health check');
    console.log('  GET  /providers           - List AI providers');
    console.log('  GET  /pricing             - Get pricing info');
    console.log('  GET  /history/:wallet     - Get wallet history');
    console.log('  POST /generate            - Generate image/video (requires x402 payment)');
  });
}
