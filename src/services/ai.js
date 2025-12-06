const config = require('../config');

/**
 * Servicio para integración con proveedores de IA
 * Soporta: Veo 3, NanoBanana, SD 3.5, Runway Gen-3, Midjourney
 */

/**
 * Obtiene la configuración de un proveedor
 * @param {string} providerId - ID del proveedor
 * @returns {Object|null} - Configuración del proveedor
 */
function getProviderConfig(providerId) {
  return config.ai.providers[providerId] || null;
}

/**
 * Obtiene el precio de un proveedor
 * @param {string} providerId - ID del proveedor
 * @returns {number} - Precio en USD
 */
function getProviderPrice(providerId) {
  const provider = getProviderConfig(providerId);
  return provider ? provider.price : 0;
}

/**
 * Genera contenido usando el proveedor de IA especificado
 * @param {Object} params - { prompt, type, provider }
 * @returns {Object} - { data, metadata }
 */
async function generate({ prompt, type, provider }) {
  const generators = {
    nanobanana: generateWithNanoBanana,
    veo3: generateWithVeo3,
    sd35: generateWithSD35,
    runway: generateWithRunway,
    midjourney: generateWithMidjourney
  };

  const generator = generators[provider];
  if (!generator) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const providerConfig = getProviderConfig(provider);

  return generator(prompt, type, providerConfig);
}

/**
 * NanoBanana - Generación de imágenes
 */
async function generateWithNanoBanana(prompt, type) {
  // TODO: Implementar integración real con NanoBanana API
  console.log(`[NanoBanana] Generating ${type}: ${prompt}`);

  return {
    data: Buffer.from('placeholder'),
    metadata: {
      provider: 'nanobanana',
      model: 'nanobanana-v1',
      prompt
    }
  };
}

/**
 * Veo 3 - Generación de videos (Google)
 */
async function generateWithVeo3(prompt, type) {
  // TODO: Implementar integración real con Veo 3 API
  console.log(`[Veo3] Generating ${type}: ${prompt}`);

  return {
    data: Buffer.from('placeholder'),
    metadata: {
      provider: 'veo3',
      model: 'veo-3',
      prompt
    }
  };
}

/**
 * Stable Diffusion 3.5
 */
async function generateWithSD35(prompt, type) {
  // TODO: Implementar integración real con SD 3.5 API
  console.log(`[SD3.5] Generating ${type}: ${prompt}`);

  return {
    data: Buffer.from('placeholder'),
    metadata: {
      provider: 'sd35',
      model: 'stable-diffusion-3.5',
      prompt
    }
  };
}

/**
 * Runway Gen-3 - Videos
 */
async function generateWithRunway(prompt, type) {
  // TODO: Implementar integración real con Runway API
  console.log(`[Runway] Generating ${type}: ${prompt}`);

  return {
    data: Buffer.from('placeholder'),
    metadata: {
      provider: 'runway',
      model: 'gen-3',
      prompt
    }
  };
}

/**
 * Midjourney - Imágenes de alta calidad
 */
async function generateWithMidjourney(prompt, type) {
  // TODO: Implementar integración real con Midjourney API
  console.log(`[Midjourney] Generating ${type}: ${prompt}`);

  return {
    data: Buffer.from('placeholder'),
    metadata: {
      provider: 'midjourney',
      model: 'mj-v6',
      prompt
    }
  };
}

/**
 * Lista de proveedores disponibles con toda su información
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
 * @param {string} type - 'image' o 'video'
 */
function getProvidersByType(type) {
  return getAvailableProviders().filter(p => p.type === type);
}

module.exports = {
  generate,
  getAvailableProviders,
  getProvidersByType,
  getProviderConfig,
  getProviderPrice
};
