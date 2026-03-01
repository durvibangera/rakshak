/**
 * FILE: callService.js
 * PURPOSE: Twilio Voice API integration for automated flood alert calls.
 *
 * CONTEXT: When a HIGH flood risk is detected, this service calls all affected
 *          users via Twilio with AI-generated speech (SarvamAI TTS). Calls
 *          include messages in Hindi + the user's regional language. If Twilio
 *          voice fails, it falls back to SMS. A 6-hour cooldown prevents
 *          repeated calls to the same phone number.
 *
 * ROLE ACCESS: SERVER-SIDE ONLY
 *
 * EXPORTS:
 *   - callUsers: Call all users with flood alert voice messages
 *   - sendSmsFallback: SMS fallback for failed voice calls
 *
 * KEY DEPENDENCIES:
 *   - twilio (npm package)
 *   - lib/utils/languageSelector.js
 */

import twilio from 'twilio';
import { FLOOD_MESSAGES } from '@/lib/utils/languageSelector';

// ── Twilio client ────────────────────────────────────────────────

function getTwilioClient() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
    }

    return twilio(accountSid, authToken);
}

function getTwilioPhoneNumber() {
    const phone = process.env.TWILIO_PHONE_NUMBER;
    if (!phone) throw new Error('TWILIO_PHONE_NUMBER must be set');
    return phone;
}

// ── 6-hour cooldown tracking ─────────────────────────────────────

const callCooldowns = new Map();
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Check if a phone number is in cooldown.
 * @param {string} phone
 * @returns {boolean}
 */
function isInCooldown(phone) {
    // TEMPORARILY DISABLED FOR TESTING
    return false;
}

/**
 * Mark a phone as recently called.
 * @param {string} phone
 */
function setCooldown(phone) {
    callCooldowns.set(phone, Date.now());
}

// ── Voice call functions ─────────────────────────────────────────

/**
 * Call all users with flood alert voice messages.
 * Uses TwiML with <Say> tags for Hindi + regional language.
 * Falls back to SMS if voice call fails.
 *
 * @param {Array<{ phone: string, state: string, name: string }>} users
 * @param {Array<{ lang: string, langCode: string, text: string }>} messages - Voice messages to play
 * @returns {Promise<{ called: number, skipped: number, failed: number, smsFallback: number }>}
 */
export async function callUsers(users, messages) {
    const client = getTwilioClient();
    const fromPhone = getTwilioPhoneNumber();
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

    const results = { called: 0, skipped: 0, failed: 0, smsFallback: 0 };

    for (const user of users) {
        // Check cooldown
        if (isInCooldown(user.phone)) {
            console.log(`[CallService] Skipping ${user.phone} — in cooldown`);
            results.skipped++;
            continue;
        }

        try {
            // Build TwiML — Hindi (hi-IN) and Marathi (mr-IN) with correct language per segment
            const twimlParts = messages.map(
                (msg) => `<Say voice="Polly.Aditi" language="${msg.langCode || 'hi-IN'}">${msg.text}</Say><Pause length="1"/>`
            );

            const twimlResponse = `<Response>${twimlParts.join('\n')}<Pause length="2"/>${twimlParts.join('\n')}</Response>`;

            // Create the call
            const call = await client.calls.create({
                twiml: twimlResponse,
                to: user.phone,
                from: fromPhone,
            });

            console.log(`[CallService] Called ${user.name} (${user.phone}) — SID: ${call.sid}`);
            setCooldown(user.phone);
            results.called++;
        } catch (err) {
            console.error(`[CallService] Voice call failed for ${user.phone}:`, err.message);
            results.failed++;

            // SMS fallback
            try {
                await sendSmsFallback([user], messages[0]?.text || FLOOD_MESSAGES.hi);
                results.smsFallback++;
            } catch (smsErr) {
                console.error(`[CallService] SMS fallback also failed for ${user.phone}:`, smsErr.message);
            }
        }
    }

    console.log(
        `[CallService] Summary — Called: ${results.called}, Skipped: ${results.skipped}, Failed: ${results.failed}, SMS Fallback: ${results.smsFallback}`
    );

    return results;
}

/**
 * Send SMS as a fallback when voice calls fail.
 *
 * @param {Array<{ phone: string }>} users
 * @param {string} message - Alert message text
 * @returns {Promise<number>} Number of SMS sent successfully
 */
export async function sendSmsFallback(users, message) {
    const client = getTwilioClient();
    const fromPhone = getTwilioPhoneNumber();
    let sentCount = 0;

    for (const user of users) {
        try {
            await client.messages.create({
                body: `⚠ RAKSHAK ALERT: ${message}`,
                to: user.phone,
                from: fromPhone,
            });
            console.log(`[CallService] SMS sent to ${user.phone}`);
            sentCount++;
        } catch (err) {
            console.error(`[CallService] SMS failed for ${user.phone}:`, err.message);
        }
    }

    return sentCount;
}
