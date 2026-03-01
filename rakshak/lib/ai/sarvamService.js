/**
 * FILE: sarvamService.js
 * PURPOSE: Wrapper for SarvamAI API — handles multilingual translation and text-to-speech.
 *
 * CONTEXT: Most disaster victims in India speak only their regional language and
 *          may be illiterate. SarvamAI provides high-quality Indian language
 *          translation and TTS to make the app accessible. This service translates
 *          UI strings, alert messages, and chatbot responses, and generates audio
 *          for voice-based guidance (including flood alert calls).
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - translateText: Translate text between Indian languages
 *   - textToSpeech: Convert text to speech audio in a given language
 *   - generateFloodVoice: High-level wrapper for flood alert TTS
 *
 * KEY DEPENDENCIES:
 *   - SarvamAI REST API (https://api.sarvam.ai)
 */

const SARVAM_BASE_URL = 'https://api.sarvam.ai';

/**
 * Get the SarvamAI API key from environment.
 * @returns {string}
 */
function getApiKey() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error('SARVAM_API_KEY is not set');
  return key;
}

/**
 * Translate text from one Indian language to another using SarvamAI.
 * @param {Object} params
 * @param {string} params.text - Text to translate
 * @param {string} params.sourceLang - Source language code (e.g. 'en')
 * @param {string} params.targetLang - Target language code (e.g. 'hi')
 * @returns {Promise<string>} Translated text
 */
export async function translateText({ text, sourceLang, targetLang }) {
  const apiKey = getApiKey();

  const response = await fetch(`${SARVAM_BASE_URL}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'API-Subscription-Key': apiKey,
    },
    body: JSON.stringify({
      input: text,
      source_language_code: sourceLang,
      target_language_code: targetLang,
      speaker_gender: 'Male',
      mode: 'formal',
      model: 'mayura:v1',
      enable_preprocessing: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[SarvamAI] Translation error:', errText);
    throw new Error(`SarvamAI translation failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.translated_text || text;
}

/**
 * Convert text to speech audio using SarvamAI TTS.
 * Returns base64-encoded audio data.
 *
 * @param {Object} params
 * @param {string} params.text - Text to convert to speech
 * @param {string} params.language - Language code (e.g. 'hi-IN')
 * @returns {Promise<string>} Base64-encoded audio (WAV format)
 */
export async function textToSpeech({ text, language }) {
  const apiKey = getApiKey();

  const response = await fetch(`${SARVAM_BASE_URL}/text-to-speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'API-Subscription-Key': apiKey,
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: language,
      speaker: 'meera',
      pitch: 0,
      pace: 1.0,
      loudness: 1.5,
      speech_sample_rate: 8000,        // 8kHz — optimised for phone calls
      enable_preprocessing: true,
      model: 'bulbul:v1',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[SarvamAI] TTS error:', errText);
    throw new Error(`SarvamAI TTS failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  // SarvamAI returns { audios: [ "base64..." ] }
  if (data.audios && data.audios.length > 0) {
    return data.audios[0];
  }

  throw new Error('SarvamAI TTS returned no audio data');
}

/**
 * Generate flood alert voice audio using SarvamAI TTS.
 * This is the high-level wrapper used by the call service.
 *
 * @param {string} text - The flood alert message text
 * @param {string} langCode - BCP-47 language code (e.g. 'hi-IN')
 * @returns {Promise<string>} Base64-encoded WAV audio
 */
export async function generateFloodVoice(text, langCode) {
  try {
    const audioBase64 = await textToSpeech({ text, language: langCode });
    console.log(`[SarvamAI] Generated flood voice audio for ${langCode} (${text.substring(0, 40)}...)`);
    return audioBase64;
  } catch (err) {
    console.error(`[SarvamAI] Failed to generate flood voice for ${langCode}:`, err.message);
    // Return null — the call service will fall back to Twilio <Say>
    return null;
  }
}
