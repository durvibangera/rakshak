/**
 * FILE: route.js (Test Call)
 * PURPOSE: Test endpoint to trigger a voice call with all supported languages.
 *
 * USAGE:
 *   GET /api/test-call?phone=+919821158848              → Hindi + Marathi (default)
 *   GET /api/test-call?phone=+91...&lang=gu             → Hindi + Gujarati
 *   GET /api/test-call?phone=+91...&lang=kn             → Hindi + Kannada
 *   GET /api/test-call?phone=+91...&lang=ta             → Hindi + Tamil
 *   GET /api/test-call?phone=+91...&lang=all            → ALL languages
 */

import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { FLOOD_MESSAGES } from '@/lib/utils/languageSelector';

const LANG_LABELS = { hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ta: 'Tamil' };

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const phone = searchParams.get('phone');
        const lang = searchParams.get('lang') || 'mr';

        if (!phone) {
            return NextResponse.json({
                error: 'phone required',
                usage: {
                    marathi: '/api/test-call?phone=+91...&lang=mr',
                    gujarati: '/api/test-call?phone=+91...&lang=gu',
                    kannada: '/api/test-call?phone=+91...&lang=kn',
                    tamil: '/api/test-call?phone=+91...&lang=ta',
                    all: '/api/test-call?phone=+91...&lang=all',
                },
            }, { status: 400 });
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromPhone = process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !fromPhone) {
            return NextResponse.json({ error: 'Twilio credentials not set' }, { status: 500 });
        }

        const client = twilio(accountSid, authToken);

        // Build TwiML — always Hindi first, then regional language(s)
        let sayParts = [];
        sayParts.push(`<Say language="hi-IN" voice="Polly.Aditi">${FLOOD_MESSAGES.hi}</Say>`);
        sayParts.push('<Pause length="1"/>');

        if (lang === 'all') {
            for (const code of ['mr', 'gu', 'kn', 'ta']) {
                sayParts.push(`<Say language="hi-IN" voice="Polly.Aditi">${FLOOD_MESSAGES[code]}</Say>`);
                sayParts.push('<Pause length="1"/>');
            }
        } else if (lang !== 'hi' && FLOOD_MESSAGES[lang]) {
            sayParts.push(`<Say language="hi-IN" voice="Polly.Aditi">${FLOOD_MESSAGES[lang]}</Say>`);
            sayParts.push('<Pause length="1"/>');
        }

        // Repeat Hindi at end
        sayParts.push(`<Say language="hi-IN" voice="Polly.Aditi">${FLOOD_MESSAGES.hi}</Say>`);

        const twiml = `<Response>\n  ${sayParts.join('\n  ')}\n</Response>`;

        const call = await client.calls.create({ twiml, to: phone, from: fromPhone });

        const languages = ['Hindi'];
        if (lang === 'all') languages.push('Marathi', 'Gujarati', 'Kannada', 'Tamil');
        else if (LANG_LABELS[lang] && lang !== 'hi') languages.push(LANG_LABELS[lang]);

        return NextResponse.json({
            success: true,
            callSid: call.sid,
            languages,
        });
    } catch (err) {
        console.error('Test call error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
