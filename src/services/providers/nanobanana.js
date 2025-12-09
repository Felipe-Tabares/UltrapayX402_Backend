const { GoogleGenAI } = require('@google/genai');
const config = require('../../config');

let ai = null;

// Initialize Google GenAI client
function initClient() {
  if (ai) return ai;

  const apiKey = config.apiKeys.google;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not configured');
  }

  ai = new GoogleGenAI({ apiKey });
  console.log('[NanoBanana] Google GenAI client initialized');
  return ai;
}

/**
 * Generate image using Gemini (Nano Banana)
 * @param {string} prompt - The image prompt
 * @returns {Object} - { data: Buffer, metadata: Object }
 */
async function generate(prompt) {
  const client = initClient();

  console.log(`[NanoBanana] Generating image: "${prompt.substring(0, 50)}..."`);

  try {
    // Use Imagen 4.0 for image generation
    const response = await client.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1'
      }
    });

    // Imagen 4.0 returns generatedImages array
    const generatedImages = response.generatedImages || [];

    if (!generatedImages.length || !generatedImages[0].image?.imageBytes) {
      throw new Error('No image generated in response');
    }

    // Get base64 image data
    const imageData = generatedImages[0].image.imageBytes;

    // Convert base64 to Buffer
    const data = Buffer.from(imageData, 'base64');

    console.log(`[NanoBanana] Success! Generated ${data.length} bytes`);

    return {
      data,
      metadata: {
        provider: 'nanobanana',
        model: 'imagen-4.0-generate-001',
        prompt,
        mimeType: 'image/jpeg'
      }
    };

  } catch (error) {
    console.error('[NanoBanana] Error:', error.message);
    throw new Error(`NanoBanana generation failed: ${error.message}`);
  }
}

/**
 * Check if the provider is configured
 */
function isConfigured() {
  return !!config.apiKeys.google;
}

module.exports = {
  generate,
  isConfigured
};
