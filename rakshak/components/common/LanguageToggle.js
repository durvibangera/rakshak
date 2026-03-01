/**
 * FILE: LanguageToggle.js
 * PURPOSE: Dropdown to switch the app's display language.
 *
 * CONTEXT: Victims and NGOs can switch between Indian languages at any time.
 *          This dropdown shows all supported languages with their native script
 *          labels (e.g., हिन्दी, मराठी). Selecting a language updates the
 *          LanguageContext, which re-renders all translatable strings.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - LanguageToggle: React component
 *
 * KEY DEPENDENCIES:
 *   - context/LanguageContext.js
 *   - constants/languages.js
 *
 * TODO:
 *   [ ] Render dropdown with all supported languages
 *   [ ] Show native labels (e.g., हिन्दी not "Hindi")
 *   [ ] Highlight current selection
 *   [ ] Persist choice to localStorage via context
 */

'use client';

import { useLanguage } from '@/context/LanguageContext';
import { LANGUAGES } from '@/constants/languages';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value)}
      className="bg-slate-800 text-slate-200 border border-slate-600 rounded-lg 
                 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label="Select language"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.nativeLabel}
        </option>
      ))}
    </select>
  );
}
