/**
 * FILE: route.js (TTS Audio)
 * PURPOSE: Generate and serve SarvamAI TTS audio as WAV for Twilio to play.
 *
 * USAGE: GET /api/tts-audio?lang=hi&text=...
 *        Returns audio/wav binary data
 */

import { NextResponse } from 'next/server';
import { FLOOD_MESSAGES } from '@/lib/utils/languageSelector';

const SARVAM_BASE_URL = 'https://api.sarvam.ai';

// Language code mapping for SarvamAI
const SARVAM_LANG_CODES = {
    hi: 'hi-IN',
    mr: 'mr-IN',
    gu: 'gu-IN',
    kn: 'kn-IN',
    ta: 'ta-IN',
};

// Cache generated audio to avoid repeated API calls
const audioCache = new Map();

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const lang = searchParams.get('lang') || 'hi';
        const text = searchParams.get('text') || FLOOD_MESSAGES[lang] || FLOOD_MESSAGES.hi;

        // Check cache
        const cacheKey = `${lang}:${text}`;
        if (audioCache.has(cacheKey)) {
            const cachedAudio = audioCache.get(cacheKey);
            return new NextResponse(cachedAudio, {
                status: 200,
                headers: {
                    'Content-Type': 'audio/wav',
                    'Cache-Control': 'public, max-age=86400',
                },
            });
        }

        const apiKey = process.env.SARVAM_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'SARVAM_API_KEY not set' }, { status: 500 });
        }

        const langCode = SARVAM_LANG_CODES[lang] || 'hi-IN';

        // Call SarvamAI TTS
        const response = await fetch(`${SARVAM_BASE_URL}/text-to-speech`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'API-Subscription-Key': apiKey,
            },
            body: JSON.stringify({
                inputs: [text],
                target_language_code: langCode,
                speaker: 'meera',
                pitch: 0,
                pace: 1.0,
                loudness: 1.5,
                speech_sample_rate: 8000,
                enable_preprocessing: true,
                model: 'bulbul:v1',
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('[TTS Audio] SarvamAI error:', errText);
            return NextResponse.json(
                { error: `SarvamAI TTS failed: ${errText}` },
                { status: 500 }
            );
        }

        const data = await response.json();

        if (!data.audios || data.audios.length === 0) {
            return NextResponse.json({ error: 'No audio generated' }, { status: 500 });
        }

        // Convert base64 to buffer
        const audioBuffer = Buffer.from(data.audios[0], 'base64');

        // Cache it
        audioCache.set(cacheKey, audioBuffer);

        return new NextResponse(audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/wav',
                'Content-Length': audioBuffer.length.toString(),
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch (err) {
        console.error('[TTS Audio] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
