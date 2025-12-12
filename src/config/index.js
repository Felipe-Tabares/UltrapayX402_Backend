require('dotenv').config();

module.exports = {
  // MongoDB Configuration
  mongodb: {
    uri: process.env.MONGODB_URI || ''
  },
  // AWS Configuration (opcional - solo para S3)
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.S3_BUCKET || 'ultrapay-media'
  },
  // x402 Configuration
  x402: {
    facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://facilitator.ultravioletadao.xyz',
    walletAddress: process.env.X402_WALLET_ADDRESS || '0x34033041a5944B8F10f8E4D8496Bfb84f1A293A8',
    network: process.env.X402_NETWORK || 'base-sepolia'
  },
  // Server Configuration
  server: {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  // AI Provider API Keys
  apiKeys: {
    google: process.env.GOOGLE_API_KEY || '',
    huggingface: process.env.HF_TOKEN || ''
  },
  // Precios por modelo en USD (USDC)
  ai: {
    huggingfaceModel: process.env.HF_MODEL || 'black-forest-labs/FLUX.1-dev',
    providers: {
      nanobanana: {
        name: 'NanoBanana',
        type: 'image',
        price: 0.10,
        description: 'FLUX.1 - Alta calidad',
        model: 'black-forest-labs/FLUX.1-dev',
        backend: 'huggingface'
      }
    },
    defaultProvider: 'nanobanana'
  }
};
