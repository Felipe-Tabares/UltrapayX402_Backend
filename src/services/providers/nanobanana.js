const config = require('../../config');

// Hugging Face Configuration (new router endpoint)
const HF_API_URL = 'https://router.huggingface.co/hf-inference/models';
const DEFAULT_MODEL = 'black-forest-labs/FLUX.1-dev';

/**
 * Generate image using Hugging Face Inference API
 * @param {string} prompt - The image prompt
 * @returns {Object} - { data: Buffer, metadata: Object }
 */
async function generate(prompt) {
  const hfToken = config.apiKeys.huggingface;

  if (!hfToken) {
    throw new Error('HF_TOKEN not configured');
  }

  const model = config.ai?.huggingfaceModel || DEFAULT_MODEL;
  const apiUrl = `${HF_API_URL}/${model}`;

  console.log(`[NanoBanana] Generating image with Hugging Face: "${prompt.substring(0, 50)}..."`);
  console.log(`[NanoBanana] Model: ${model}`);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          width: 1024,
          height: 1024,
          guidance_scale: 7.5,
          num_inference_steps: 30
        }
      })
    });

    // Check if response is an image
    const contentType = response.headers.get('content-type') || '';

    if (contentType.startsWith('image/')) {
      // Success - response is image bytes
      const arrayBuffer = await response.arrayBuffer();
      const data = Buffer.from(arrayBuffer);

      console.log(`[NanoBanana] Success! Generated ${data.length} bytes (${contentType})`);

      return {
        data,
        metadata: {
          provider: 'nanobanana',
          model: model,
          prompt,
          mimeType: contentType.split(';')[0] // 'image/png' or 'image/jpeg'
        }
      };
    }

    // Error response - parse JSON
    const errorData = await response.json();

    // Handle model loading (503)
    if (response.status === 503 && errorData.estimated_time) {
      throw new Error(`Model is loading. Estimated time: ${Math.ceil(errorData.estimated_time)} seconds. Please retry.`);
    }

    throw new Error(errorData.error || `HTTP ${response.status}: Unknown error`);

  } catch (error) {
    console.error('[NanoBanana] Error:', error.message);
    throw new Error(`NanoBanana generation failed: ${error.message}`);
  }
}

/**
 * Check if the provider is configured
 */
function isConfigured() {
  return !!config.apiKeys.huggingface;
}

module.exports = {
  generate,
  isConfigured
};
