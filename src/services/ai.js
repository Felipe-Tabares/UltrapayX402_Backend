const config = require('../config');
const nanobananaProvider = require('./providers/nanobanana');

/**
 * Servicio para integración con proveedores de IA
 */

/**
 * Obtiene la configuración de un proveedor
 */
function getProviderConfig(providerId) {
  return config.ai.providers[providerId] || null;
}

/**
 * Obtiene el precio de un proveedor
 */
function getProviderPrice(providerId) {
  const provider = getProviderConfig(providerId);
  return provider ? provider.price : 0;
}

/**
 * Genera contenido usando el proveedor de IA especificado
 */
async function generate({ prompt, type, provider }) {
  const providerConfig = getProviderConfig(provider);

  if (!providerConfig) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  console.log(`[AI] Generating ${type} with ${provider}: "${prompt.substring(0, 50)}..."`);

  // Route to the appropriate provider
  switch (provider) {
    case 'nanobanana':
      return nanobananaProvider.generate(prompt);
    default:
      throw new Error(`Provider not implemented: ${provider}`);
  }
}

/**
 * Lista de proveedores disponibles
 */
function getAvailableProviders() {
  const providers = config.ai.providers;
  return Object.entries(providers).map(([id, info]) => ({
    id,
    name: info.name,
    type: info.type,
    price: info.price,
    description: info.description,
    model: info.model
  }));
}

/**
 * Obtiene proveedores filtrados por tipo
 */
function getProvidersByType(type) {
  return getAvailableProviders().filter(p => p.type === type);
}

/**
 * Check if AI services are configured
 */
function isConfigured() {
  return nanobananaProvider.isConfigured();
}

module.exports = {
  generate,
  getAvailableProviders,
  getProvidersByType,
  getProviderConfig,
  getProviderPrice,
  isConfigured
};
