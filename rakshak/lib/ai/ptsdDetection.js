/**
 * FILE: ptsdDetection.js
 * PURPOSE: Keyword-based PTSD flag detection in chat conversations.
 *
 * CONTEXT: After the initial 48-hour survival phase, many disaster victims
 *          experience PTSD symptoms. This module analyzes chat messages for
 *          keywords indicating distress, suicidal ideation, or trauma across
 *          multiple Indian languages. When flagged, the system connects the
 *          victim to counselors and helplines.
 *
 * ROLE ACCESS: BOTH (runs server-side in chat API route)
 *
 * EXPORTS:
 *   - detectPTSDFlags: Analyze a message for distress indicators
 *   - PTSD_KEYWORDS: Keyword lists by language
 *
 * KEY DEPENDENCIES: None
 *
 * TODO:
 *   [ ] Build keyword lists for English, Hindi, Marathi, Tamil, Bengali
 *   [ ] Implement scoring algorithm (keyword match + frequency)
 *   [ ] Return severity level and recommended action
 *   [ ] Add helpline numbers per detected language
 */

/** @type {Record<string, string[]>} */
export const PTSD_KEYWORDS = {
  en: [
    'hopeless', 'no point', 'want to die', 'kill myself', 'nightmare',
    'cant sleep', 'scared all the time', 'flashback', 'panic',
    'nobody cares', 'alone', 'give up', 'end it', 'worthless',
  ],
  hi: [
    'निराशा', 'मरना चाहता', 'डर लगता है', 'बुरे सपने', 'अकेला',
    'कोई नहीं सुनता', 'हार गया', 'जीने का मन नहीं',
  ],
  mr: [
    'निराशा', 'मरायचं', 'भीती वाटते', 'वाईट स्वप्न', 'एकटा',
  ],
};

/**
 * Analyze a message for PTSD/distress indicators.
 * @param {Object} params
 * @param {string} params.message - The user's chat message
 * @param {string} params.language - Language code of the message
 * @returns {{ flagged: boolean, severity: string, matchedKeywords: string[] }}
 */
export function detectPTSDFlags({ message, language }) {
  const keywords = PTSD_KEYWORDS[language] || PTSD_KEYWORDS['en'];
  const lowerMessage = message.toLowerCase();
  const matchedKeywords = keywords.filter((kw) => lowerMessage.includes(kw.toLowerCase()));

  const flagged = matchedKeywords.length > 0;
  let severity = 'none';
  if (matchedKeywords.length >= 3) severity = 'high';
  else if (matchedKeywords.length >= 1) severity = 'medium';

  return { flagged, severity, matchedKeywords };
}
