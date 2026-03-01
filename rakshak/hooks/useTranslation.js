/**
 * FILE: useTranslation.js
 * PURPOSE: Hook for translating UI strings using the current language context.
 *
 * CONTEXT: Wraps the language context and translation utility into a simple
 *          hook. Components call t('key') to get the translated string in
 *          the current language. Falls back to English if a translation is
 *          missing. Can also call SarvamAI for dynamic translations.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - useTranslation: Hook returning { t, language, setLanguage }
 *
 * KEY DEPENDENCIES:
 *   - context/LanguageContext.js
 *   - lib/utils/languageConfig.js
 *
 * TODO:
 *   [ ] Add dynamic translation via SarvamAI for user-generated content
 *   [ ] Cache dynamic translations in sessionStorage
 */

'use client';

import { useLanguage } from '@/context/LanguageContext';
import { t as translate } from '@/lib/utils/languageConfig';

/**
 * Translation hook — provides t() function bound to current language.
 * @returns {{ t: (key: string) => string, language: string, setLanguage: (lang: string) => void }}
 */
export function useTranslation() {
  const { language, setLanguage } = useLanguage();

  /**
   * Translate a key to the current language.
   * @param {string} key - Translation key
   * @returns {string} Translated string
   */
  const t = (key) => translate(key, language);

  return { t, language, setLanguage };
}
