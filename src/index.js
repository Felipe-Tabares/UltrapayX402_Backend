const express = require('express');
const serverless = require('serverless-http');
const { generateHandler } = require('./handlers/generate');
const { healthHandler } = require('./handlers/health');
const aiService = require('./services/ai');
const config = require('./config');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS para frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Payment, x402-payment, X-PAYMENT, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Expose-Headers', 'X-Payment-Response, x-payment-response');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Importar y configurar x402-express de forma dinamica (ES Module)
async function setupX402Middleware() {
  try {
    // Importar x402-express dinamicamente
    const { paymentMiddleware } = await import('x402-express');

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
      price: `$${minPrice}`,
      network: config.x402.network,
      config: {
        description: 'UltraPayx402 - AI Image/Video Generation',
        maxTimeoutSeconds: 120
      }
    };

    // Aplicar middleware x402
    app.use(paymentMiddleware(
      config.x402.walletAddress,
      routeConfigs,
      { url: config.x402.facilitatorUrl }
    ));

    console.log('x402 middleware configured successfully');
    console.log(`Wallet: ${config.x402.walletAddress}`);
    console.log(`Facilitator: ${config.x402.facilitatorUrl}`);
    console.log(`Network: ${config.x402.network}`);

  } catch (error) {
    console.error('Error setting up x402 middleware:', error.message);
    console.log('Running without x402 middleware (payment verification will be simulated)');
  }
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

// Inicializar x402 middleware
setupX402Middleware();

// Export para Lambda (si se usa en AWS)
module.exports.handler = serverless(app);

// Export app
module.exports.app = app;

// Iniciar servidor solo si NO estamos en Lambda
// Lambda define AWS_LAMBDA_FUNCTION_NAME
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UltraPay Backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('Endpoints:');
    console.log('  GET  /health    - Health check');
    console.log('  GET  /providers - List AI providers');
    console.log('  GET  /pricing   - Get pricing info');
    console.log('  POST /generate  - Generate image/video (requires x402 payment)');
  });
}
