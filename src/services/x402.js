const config = require('../config');

/**
 * Servicio para integración con x402 micropayments
 * Docs: https://x402.gitbook.io/x402/getting-started/quickstart-for-sellers
 */

/**
 * Verifica el pago x402 en el request
 * @param {Object} req - Express request
 * @param {number} price - Precio en USD
 * @returns {Object} - { success, paymentHash, x402Headers }
 */
async function verifyPayment(req, price) {
  const paymentHeader = req.headers['x-payment'] || req.headers['x402-payment'];

  if (!paymentHeader) {
    return {
      success: false,
      x402Headers: {
        'X-Payment-Required': 'true',
        'X-Payment-Amount': price.toString(),
        'X-Payment-Currency': 'USD',
        'X-Payment-Recipient': config.x402.walletAddress,
        'X-Facilitator-URL': config.x402.facilitatorUrl
      }
    };
  }

  try {
    // TODO: Implementar verificación real con facilitador x402
    // Por ahora, simular verificación para desarrollo
    const isValid = await verifyWithFacilitator(paymentHeader, price);

    if (isValid) {
      return {
        success: true,
        paymentHash: extractPaymentHash(paymentHeader)
      };
    }

    return {
      success: false,
      x402Headers: {
        'X-Payment-Required': 'true',
        'X-Payment-Invalid': 'true'
      }
    };

  } catch (error) {
    console.error('x402 verification error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verifica el pago con el facilitador x402
 */
async function verifyWithFacilitator(paymentHeader, expectedAmount) {
  // TODO: Implementar llamada real al facilitador
  // const response = await fetch(config.x402.facilitatorUrl + '/verify', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ payment: paymentHeader, amount: expectedAmount })
  // });
  // return response.ok;

  // Simulación para desarrollo
  return paymentHeader && paymentHeader.length > 0;
}

/**
 * Extrae el hash de pago del header
 */
function extractPaymentHash(paymentHeader) {
  // TODO: Parsear el header real de x402
  return paymentHeader.substring(0, 66) || 'simulated-hash';
}

/**
 * Genera headers de respuesta 402 para solicitar pago
 */
function generatePaymentRequired(price, description) {
  return {
    status: 402,
    headers: {
      'X-Payment-Required': 'true',
      'X-Payment-Amount': price.toString(),
      'X-Payment-Currency': 'USD',
      'X-Payment-Recipient': config.x402.walletAddress,
      'X-Payment-Description': description,
      'X-Facilitator-URL': config.x402.facilitatorUrl
    }
  };
}

module.exports = {
  verifyPayment,
  generatePaymentRequired
};
