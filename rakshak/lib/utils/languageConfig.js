/**
 * FILE: languageConfig.js
 * PURPOSE: Centralized language configuration and translation keys mapping.
 *
 * CONTEXT: Every user-facing string in Rakshak must be translatable. This file
 *          provides the core translation keys for essential UI strings (button
 *          labels, status messages, navigation items) so the app can render
 *          in any supported language from day one — even without the SarvamAI
 *          API online.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - TRANSLATIONS: Object mapping translation keys to language strings
 *   - t: Helper function to get a translated string
 *
 * KEY DEPENDENCIES:
 *   - constants/languages.js
 *
 * TODO:
 *   [ ] Add full translation strings for all critical UI elements
 *   [ ] Add Marathi, Tamil, Bengali translations
 *   [ ] Integrate with SarvamAI for dynamic translations
 */

/** @type {Record<string, Record<string, string>>} */
export const TRANSLATIONS = {
  // Navigation
  'nav.home': { en: 'Home', hi: 'होम', mr: 'मुख्यपृष्ठ' },
  'nav.map': { en: 'Find Camp', hi: 'कैंप खोजें', mr: 'कॅम्प शोधा' },
  'nav.family': { en: 'Family', hi: 'परिवार', mr: 'कुटुंब' },
  'nav.aiGuide': { en: 'AI Guide', hi: 'AI गाइड', mr: 'AI मार्गदर्शक' },
  'nav.myCard': { en: 'My Card', hi: 'मेरा कार्ड', mr: 'माझे कार्ड' },

  // Status
  'status.safe': { en: 'Safe', hi: 'सुरक्षित', mr: 'सुरक्षित' },
  'status.missing': { en: 'Missing', hi: 'लापता', mr: 'बेपत्ता' },
  'status.unknown': { en: 'Unknown', hi: 'अज्ञात', mr: 'अज्ञात' },

  // Camp status
  'camp.open': { en: 'Open', hi: 'खुला', mr: 'उघडा' },
  'camp.nearlyFull': { en: 'Nearly Full', hi: 'लगभग भरा', mr: 'जवळजवळ भरलेला' },
  'camp.full': { en: 'Full', hi: 'भरा हुआ', mr: 'भरलेला' },
  'camp.closed': { en: 'Closed', hi: 'बंद', mr: 'बंद' },

  // Actions
  'action.navigate': { en: 'Navigate to Camp', hi: 'कैंप तक पहुंचें', mr: 'कॅम्पला जा' },
  'action.sos': { en: 'SOS Emergency', hi: 'SOS आपातकालीन', mr: 'SOS आणीबाणी' },
  'action.reportMissing': { en: 'Report Missing', hi: 'लापता रिपोर्ट', mr: 'बेपत्ता नोंदवा' },

  // Messages
  'msg.offline': { en: 'You are offline. Showing cached data.', hi: 'आप ऑफ़लाइन हैं। कैश्ड डेटा दिखा रहे हैं।', mr: 'तुम्ही ऑफलाइन आहात. कॅश डेटा दाखवत आहे.' },
  'msg.campFull': { en: 'This camp is crowded. You can still arrive — relief workers will help find you a space.', hi: 'यह कैंप भरा हुआ है। आप फिर भी आ सकते हैं — राहत कर्मी आपकी मदद करेंगे।', mr: 'हा कॅम्प गर्दीचा आहे. तुम्ही तरीही येऊ शकता — मदत कर्मचारी तुम्हाला जागा शोधून देतील.' },
};

/**
 * Get a translated string for a given key and language.
 * @param {string} key - Translation key (e.g. 'nav.home')
 * @param {string} [lang='en'] - Language code
 * @returns {string} Translated string, or the key itself as fallback
 */
export function t(key, lang = 'en') {
  const entry = TRANSLATIONS[key];
  if (!entry) return key;
  return entry[lang] || entry['en'] || key;
}
