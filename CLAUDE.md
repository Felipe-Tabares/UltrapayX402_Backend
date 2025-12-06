# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UltraPayx402 is a micropayment platform for professional AI image and video generation. Users pay per prompt via x402 protocol instead of subscriptions.

**IMPORTANTE**: Este repositorio es el BACKEND. El frontend está en un repositorio separado. Cada cambio implementado debe generar un prompt de instrucciones para el frontend.

## Tech Stack

- **Frontend**: React (repositorio separado)
- **Backend**: Node.js + Express (este repositorio)
- **Payments**: x402 protocol
- **Wallet**: Core Wallet

## AWS Infrastructure (Terraform)

- **Compute**: AWS Lambda (serverless)
- **API**: API Gateway
- **Storage**: S3 (imágenes/videos generados)
- **Database**: DynamoDB (serverless) o MongoDB Atlas
- **IaC**: Terraform

## AI Model Integrations

- Veo 3
- NanoBanana
- Stable Diffusion 3.5
- Runway Gen-3
- Midjourney

## x402 Integration

- **x402 Seller SDK**: https://x402.gitbook.io/x402/getting-started/quickstart-for-sellers
- **x402 Buyer SDK**: https://x402.gitbook.io/x402/getting-started/quickstart-for-buyers
- **Facilitator URL**: https://facilitator.ultravioletadao.xyz/

### EVM Wallet Addresses

- Mainnet: `0x103040545AC5031A11E8C03dd11324C7333a13C7`
- Testnet: `0x34033041a5944B8F10f8E4D8496Bfb84f1A293A8`

## Project Structure

```
ultra-pay/
├── src/
│   ├── handlers/          # Lambda handlers
│   ├── services/          # Business logic (AI, x402, storage)
│   ├── utils/             # Helpers
│   └── config/            # Configuration
├── terraform/             # Infrastructure as Code
├── tests/                 # Unit/integration tests
└── package.json
```

## Commands

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Run tests
npm test

# Deploy infrastructure
cd terraform && terraform apply

# Deploy Lambda
npm run deploy
```

## Architecture Notes

- Serverless architecture with AWS Lambda
- API Gateway for HTTP endpoints
- S3 for media storage with presigned URLs
- Multi-model routing for AI providers
- x402 micropayments per prompt

## Frontend Sync Protocol

Cada vez que se implemente una funcionalidad en el backend, se debe documentar:
1. Endpoint creado/modificado (método, ruta, params)
2. Request/Response esperado
3. Instrucciones de integración para el frontend
