/**
 * FILE: languages.js
 * PURPOSE: Define all supported languages with codes, native labels, and direction.
 *
 * CONTEXT: Rakshak serves disaster victims across India who speak different regional
 *          languages. This config drives the LanguageToggle component, translation
 *          hooks, and the SarvamAI translation service. All user-facing strings
 *          must be translatable from day one.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - LANGUAGES: Array of supported language objects
 *   - DEFAULT_LANGUAGE: Default language code
 *   - getLanguageByCode: Helper to find a language config by code
 *
 * KEY DEPENDENCIES: None
 *
 * TODO:
 *   [x] Define supported languages
 */

/** @type {Array<{ code: string, label: string, nativeLabel: string, dir: string }>} */
export const LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', dir: 'ltr' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', dir: 'ltr' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', dir: 'ltr' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', dir: 'ltr' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', dir: 'ltr' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', dir: 'ltr' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', dir: 'ltr' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', dir: 'ltr' },
  { code: 'or', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ', dir: 'ltr' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', dir: 'ltr' },
  { code: 'as', label: 'Assamese', nativeLabel: 'অসমীয়া', dir: 'ltr' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', dir: 'rtl' },
];

/** @type {string} */
export const DEFAULT_LANGUAGE = 'en';

/**
 * Find a language config by its code
 * @param {string} code - Language code (e.g. 'hi')
 * @returns {{ code: string, label: string, nativeLabel: string, dir: string } | undefined}
 */
export function getLanguageByCode(code) {
  return LANGUAGES.find((lang) => lang.code === code);
}
