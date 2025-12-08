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
    // Use Gemini 2.0 Flash for image generation (Nano Banana)
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          {
            text: prompt
          }
        ]
      
    },
      config: {
        responseModalities: ['IMAGE']
      }
    });

    // Find the image part in the response
    const parts = response.candidates?.[0]?.content?.parts || [];
    let imageData = null;

    for (const part of parts) {
      if (part.inlineData) {
        imageData = part.inlineData.data;
        break;
      }
    }

    if (!imageData) {
      throw new Error('No image generated in response');
    }

    // Convert base64 to Buffer
    const data = Buffer.from(imageData, 'base64');

    console.log(`[NanoBanana] Success! Generated ${data.length} bytes`);

    return {
      data,
      metadata: {
        provider: 'nanobanana',
        model: 'gemini-2.0-flash-exp',
        prompt,
        mimeType: 'image/png'
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
