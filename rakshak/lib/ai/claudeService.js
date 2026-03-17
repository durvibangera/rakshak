/**
 * FILE: claudeService.js
 * PURPOSE: Wrapper for Anthropic Claude API — powers the AI disaster guide chatbot.
 *
 * CONTEXT: During a disaster, victims can chat with the AI guide in their local language.
 *          The chatbot provides step-by-step survival instructions, camp directions,
 *          first-aid guidance, and emotional support. Conversations are analyzed for
 *          PTSD flags. This service is called from /app/api/chat/route.js.
 *
 * ROLE ACCESS: BOTH (victim uses chatbot, but API route handles it server-side)
 *
 * EXPORTS:
 *   - sendChatMessage: Send a message to Claude and get a response
 *   - buildSystemPrompt: Generate the disaster-specific system prompt
 *
 * KEY DEPENDENCIES:
 *   - @anthropic-ai/sdk
 *
 * TODO:
 *   [ ] Initialize Anthropic client with API key
 *   [ ] Build disaster-aware system prompt with user context
 *   [ ] Implement sendChatMessage with streaming support
 *   [ ] Add PTSD keyword detection in responses
 */

/**
 * Build a system prompt for the Sahaay AI disaster guide.
 * @param {Object} params
 * @param {string} params.language - User's preferred language code
 * @param {string} [params.userName] - User's name
 * @param {string} [params.location] - User's current location
 * @param {string} [params.disasterType] - Active disaster type
 * @returns {string} System prompt for Claude
 */
export function buildSystemPrompt({ language, userName, location, disasterType }) {
  // TODO: Implement full system prompt
  return `You are Sahaay AI, a disaster survival guide for India. 
Respond in language: ${language}. 
User: ${userName || 'Unknown'}. 
Location: ${location || 'Unknown'}.
Active disaster: ${disasterType || 'Unknown'}.
Keep responses short, clear, and actionable. Use simple language.`;
}

/**
 * Send a message to Claude and get a response.
 * @param {Object} params
 * @param {Array<{role: string, content: string}>} params.messages - Chat history
 * @param {string} params.systemPrompt - System prompt
 * @returns {Promise<string>} Claude's response text
 */
export async function sendChatMessage({ messages, systemPrompt }) {
  // TODO: Implement Anthropic API call
  // const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // const response = await anthropic.messages.create({ ... });
  throw new Error('claudeService.sendChatMessage not yet implemented');
}
