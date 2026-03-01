/**
 * FILE: route.js (Voice TwiML)
 * PURPOSE: Serve TwiML XML for Twilio voice calls with flood alert messages.
 *
 * CONTEXT: When Twilio connects a voice call, it fetches the TwiML from
 *          this endpoint to know what to play/say. This route generates
 *          TwiML with <Say> tags in Hindi + regional languages.
 *
 * ENDPOINT: GET /api/voice-twiml?lang=hi-IN&text=...
 *
 * ROLE ACCESS: PUBLIC (Twilio webhook)
 */

import { NextResponse } from 'next/server';
import { FLOOD_MESSAGES, LANGUAGE_CODES } from '@/lib/utils/languageSelector';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'hi';
    const state = searchParams.get('state') || '';

    // Build TwiML — always play Hindi first, then regional
    const sayParts = [];

    // Hindi message (always)
    sayParts.push(
        `<Say language="${LANGUAGE_CODES.hi}" voice="alice">${FLOOD_MESSAGES.hi}</Say>`
    );

    // Regional message (if applicable and different from Hindi)
    if (lang !== 'hi' && FLOOD_MESSAGES[lang]) {
        const langCode = LANGUAGE_CODES[lang] || `${lang}-IN`;
        sayParts.push(
            `<Say language="${langCode}" voice="alice">${FLOOD_MESSAGES[lang]}</Say>`
        );
    }

    // Repeat once for emphasis
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${sayParts.join('\n  ')}
  <Pause length="2"/>
  ${sayParts.join('\n  ')}
</Response>`;

    return new NextResponse(twiml, {
        status: 200,
        headers: {
            'Content-Type': 'application/xml',
        },
    });
}
