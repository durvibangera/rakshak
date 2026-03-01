/**
 * FILE: languageSelector.js
 * PURPOSE: Map Indian states to primary + secondary language for voice alerts.
 *
 * CONTEXT: When sending flood voice call alerts, we always include Hindi
 *          (primary) plus the regional language based on the user's state.
 *          This ensures maximum comprehension across India.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - getLanguagesForUser: Get primary + secondary language for a state
 *   - FLOOD_MESSAGES: Pre-written flood alert messages in all languages
 *   - LANGUAGE_CODES: Mapping of language keys to BCP-47 codes
 */

/**
 * BCP-47 language codes used by Twilio and SarvamAI.
 */
export const LANGUAGE_CODES = {
    hi: 'hi-IN',  // Hindi
    mr: 'mr-IN',  // Marathi
    gu: 'gu-IN',  // Gujarati
    kn: 'kn-IN',  // Kannada
    ta: 'ta-IN',  // Tamil
};

/**
 * State → regional language mapping.
 * Hindi is always the primary language.
 */
const STATE_LANGUAGE_MAP = {
    'maharashtra': 'mr',
    'gujarat': 'gu',
    'karnataka': 'kn',
    'tamil nadu': 'ta',
    'tamilnadu': 'ta',
    'goa': 'mr',
};

/**
 * Pre-written flood alert messages in each supported language.
 * These are used for TTS generation when SarvamAI is available,
 * and as fallback text for SMS.
 */
export const FLOOD_MESSAGES = {
    hi: 'Baadh ka khatra hai. Kripya turant surakshit sthal par chale jayein.',
    mr: 'Puur yenyaacha dhoka aahe. Krupaya surakshit thikaani jaa.',
    gu: 'Puur aavvaani shakyata chhe. Krupaa karine surakshit jagyaae jaao.',
    kn: 'Pravaahada apaayavide. Dayavittu surakshita sthalakke hogi.',
    ta: 'Vellam varugindradhu. Thayavu seidhu paadhukaappaana idaththirkku sellungal.',
};

export const EARTHQUAKE_MESSAGES = {
    hi: 'Bhukamp ka khatra hai. Kripya khuli jagah mein aayein aur imaaraton se door rahein.',
    mr: 'Bhukampacha dhoka aahe. Krupaya khulya jagela yaa aani imaartaanpasun door raha.',
    gu: 'Dhartikamp ni shakyata chhe. Krupaa karine khulaa maedaanmaa jaao.',
    kn: 'Bhukampadha apaayavide. Dayavittu thereda jaagakke hogi.',
    ta: 'Nilanadukkam abaayam ulladhu. Thayavu seidhu thirandha idaththirkku sellungal.',
};

export const LANDSLIDE_MESSAGES = {
    hi: 'Bhooskhalan ka khatra hai. Kripya pahadi ilaake se door chale jayein.',
    mr: 'Bhooskhalan cha dhoka aahe. Krupaya dongaraanpasun door jaa.',
    gu: 'Bhooskhalan ni shakyata chhe. Krupaa karine pahadi vistaarthee door jaao.',
    kn: 'Bhooskhalanadha apaayavide. Dayavittu bettada pradeshadi doora hogi.',
    ta: 'Nilachchariv abaayam ulladhu. Malai pagudhiyilirundhu vilagi sellungal.',
};

export const CYCLONE_MESSAGES = {
    hi: 'Chakravaati toofaan ka khatra hai. Kripya pukke makaan mein rahein.',
    mr: 'Chakravaati vaadalachä dhoka aahe. Krupaya majboot ghari raha.',
    gu: 'Vaavaazodaa ni shakyata chhe. Krupaa karine majboot makaan maa raho.',
    kn: 'Chakravaatada apaayavide. Dayavittu gadiyaada maneyalli iri.',
    ta: 'Puyalcchuzhchi abaayam ulladhu. Valudhuvaana kattidaththil irungal.',
};

/** Preparedness / evac-centre-moving messages (Sarvam style): get ready with essentials. */
export const PREPAREDNESS_MESSAGES = {
    hi: 'Kripya apne zaroori saman ke saath taiyar ho jayein. Aapka evacuation centre hila raha hai. Kripya tayari rakhein.',
    mr: 'Krupaya aplya aavashyak vastu gheun tayar raha. Aapala evacuation centre halaat aahe. Krupaya tayari theva.',
    gu: 'Krupaa karine jaroori saman saath taiyaar raho. Tamaro evacuation centre shift thai rahyo chhe.',
    kn: 'Dayavittu aavashyaka vastugalondige tayariri. Nimma evacuation centre move aaguttide.',
    ta: 'Thayavu seidhu avashyamana porulgaludan thayaraga irungal. Ungal evacuation centre move aagudhu.',
};

export const DISASTER_MESSAGES = {
    FLOOD: FLOOD_MESSAGES,
    EARTHQUAKE: EARTHQUAKE_MESSAGES,
    LANDSLIDE: LANDSLIDE_MESSAGES,
    CYCLONE: CYCLONE_MESSAGES,
};

/**
 * Get the primary + secondary language for a user based on their state.
 * Hindi is always included as the primary language.
 *
 * @param {string} state - Indian state name (case-insensitive)
 * @returns {{ primary: string, secondary: string|null }}
 *
 * @example
 *   getLanguagesForUser('Maharashtra')
 *   // → { primary: 'hi', secondary: 'mr' }
 *
 *   getLanguagesForUser('Uttar Pradesh')
 *   // → { primary: 'hi', secondary: null }
 */
export function getLanguagesForUser(state) {
    const normalised = (state || '').trim().toLowerCase();
    const secondary = STATE_LANGUAGE_MAP[normalised] || null;

    return {
        primary: 'hi',                      // Hindi is always primary
        secondary: secondary !== 'hi' ? secondary : null,  // avoid duplicate
    };
}

/**
 * Get all flood messages that should be played for a given user.
 * Always returns Hindi message, plus regional if applicable.
 *
 * @param {string} state - Indian state name
 * @returns {Array<{ lang: string, langCode: string, text: string }>}
 */
export function getFloodMessagesForUser(state) {
    const { primary, secondary } = getLanguagesForUser(state);
    const messages = [
        {
            lang: primary,
            langCode: LANGUAGE_CODES[primary],
            text: FLOOD_MESSAGES[primary],
        },
    ];

    if (secondary && FLOOD_MESSAGES[secondary]) {
        messages.push({
            lang: secondary,
            langCode: LANGUAGE_CODES[secondary],
            text: FLOOD_MESSAGES[secondary],
        });
    }

    return messages;
}
