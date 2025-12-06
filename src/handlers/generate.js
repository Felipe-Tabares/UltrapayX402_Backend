const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const aiService = require('../services/ai');
const storageService = require('../services/storage');

/**
 * Handler para generación de imágenes/videos con micropago x402
 *
 * NOTA: El middleware x402-express maneja automáticamente:
 * - Si no hay pago: responde 402 con instrucciones de pago
 * - Si hay pago válido: permite que el request llegue a este handler
 *
 * Cuando el request llega aquí, el pago ya fue verificado por x402.
 */
async function generateHandler(req, res) {
  try {
    const { prompt, type, provider } = req.body;

    // Validaciones básicas
    if (!prompt || !type) {
      return res.status(400).json({
        error: 'Missing required fields: prompt, type'
      });
    }

    // Validar tipo
    if (!['image', 'video'].includes(type)) {
      return res.status(400).json({
        error: 'Type must be "image" or "video"'
      });
    }

    // Validar longitud del prompt (seguridad - prevenir DoS)
    const sanitizedPrompt = String(prompt).trim();
    if (sanitizedPrompt.length < 3 || sanitizedPrompt.length > 2000) {
      return res.status(400).json({
        error: 'Prompt must be between 3 and 2000 characters'
      });
    }

    // Obtener proveedor (usar default si no se especifica)
    const selectedProvider = provider || config.ai.defaultProvider;

    // Validar que el proveedor existe
    const providerConfig = aiService.getProviderConfig(selectedProvider);
    if (!providerConfig) {
      return res.status(400).json({
        error: `Invalid provider: ${selectedProvider}`,
        availableProviders: Object.keys(config.ai.providers)
      });
    }

    // Validar que el proveedor soporta el tipo solicitado
    if (providerConfig.type !== type) {
      return res.status(400).json({
        error: `Provider ${selectedProvider} does not support type "${type}"`,
        providerType: providerConfig.type
      });
    }

    const price = providerConfig.price;
    const transactionId = uuidv4();

    // El pago ya fue verificado por x402-express middleware
    // Obtener información del pago del header de respuesta si está disponible
    const paymentHeader = req.headers['x-payment'] || req.headers['X-PAYMENT'] || '';
    const paymentHash = typeof paymentHeader === 'string' ? paymentHeader.substring(0, 100) : 'x402-verified';

    console.log(`[Generate] Processing request for ${selectedProvider}`);
    console.log(`[Generate] Prompt: ${sanitizedPrompt.substring(0, 50)}...`);
    console.log(`[Generate] Price: $${price}`);

    // Generar contenido con IA (usar prompt sanitizado)
    const result = await aiService.generate({
      prompt: sanitizedPrompt,
      type,
      provider: selectedProvider
    });

    // Subir a S3 y obtener URL
    const mediaUrl = await storageService.upload({
      data: result.data,
      type,
      transactionId
    });

    // Registrar transacción
    await storageService.saveTransaction({
      transactionId,
      prompt: sanitizedPrompt,
      type,
      provider: selectedProvider,
      providerName: providerConfig.name,
      price,
      paymentHash,
      mediaUrl,
      createdAt: new Date().toISOString()
    });

    console.log(`[Generate] Success! Transaction: ${transactionId}`);

    return res.status(200).json({
      success: true,
      transactionId,
      mediaUrl,
      type,
      provider: selectedProvider,
      providerName: providerConfig.name,
      price
    });

  } catch (error) {
    console.error('[Generate] Error:', error);
    // No exponer detalles del error en producción
    const isDev = process.env.NODE_ENV === 'development';
    return res.status(500).json({
      error: 'Internal server error',
      message: isDev ? error.message : 'An error occurred while processing your request'
    });
  }
}

module.exports = { generateHandler };
