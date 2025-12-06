require('dotenv').config();

module.exports = {
  // AWS Configuration
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.S3_BUCKET || 'ultrapay-media',
    dynamoTable: process.env.DYNAMO_TABLE || process.env.DYNAMODB_TABLE || 'ultrapay-transactions'
  },
  // x402 Configuration
  x402: {
    facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://facilitator.ultravioletadao.xyz/',
    walletAddress: process.env.X402_WALLET_ADDRESS || '0x34033041a5944B8F10f8E4D8496Bfb84f1A293A8',
    network: process.env.X402_NETWORK || 'base-sepolia'
  },
  // Server Configuration
  server: {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  // Precios por modelo en USD (USDC)
  ai: {
    providers: {
      nanobanana: {
        name: 'NanoBanana',
        type: 'image',
        price: 0.10,
        description: 'Rapido y economico',
        model: 'nanobanana-v1'
      },
      sd35: {
        name: 'SD3.5',
        type: 'image',
        price: 0.15,
        description: 'Alta calidad, versatil',
        model: 'stable-diffusion-3.5'
      },
      midjourney: {
        name: 'Midjourney',
        type: 'image',
        price: 0.20,
        description: 'Artistico premium',
        model: 'mj-v6'
      },
      veo3: {
        name: 'Veo 3',
        type: 'video',
        price: 0.85,
        description: 'Videos realistas',
        model: 'veo-3'
      },
      runway: {
        name: 'Runway Gen-3',
        type: 'video',
        price: 1.20,
        description: 'Cinematografico',
        model: 'gen-3'
      }
    },
    defaultProvider: 'nanobanana'
  }
};
