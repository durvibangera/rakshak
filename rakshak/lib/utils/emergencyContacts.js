/**
 * FILE: emergencyContacts.js
 * PURPOSE: India emergency helplines organized by state and language.
 *
 * CONTEXT: During disasters and in the recovery phase, victims need quick access
 *          to emergency helplines — NDRF, police, ambulance, women's helpline,
 *          mental health counselors, and state-specific disaster management numbers.
 *          This data powers the recovery page and is shown when PTSD flags are detected.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - NATIONAL_HELPLINES: India-wide emergency numbers
 *   - STATE_HELPLINES: State-specific disaster helplines
 *   - MENTAL_HEALTH_HELPLINES: Counseling and mental health numbers
 *   - getHelplinesByState: Get relevant helplines for a state
 *
 * KEY DEPENDENCIES: None
 *
 * TODO:
 *   [ ] Add more state-specific numbers
 *   [ ] Add NGO helplines
 *   [ ] Add language-specific counselor availability
 */

/** @type {Array<{ name: string, number: string, description: string }>} */
export const NATIONAL_HELPLINES = [
  { name: 'National Disaster Response Force (NDRF)', number: '011-24363260', description: 'Primary disaster response coordination' },
  { name: 'National Emergency Number', number: '112', description: 'Unified emergency response' },
  { name: 'Police', number: '100', description: 'Law enforcement' },
  { name: 'Ambulance', number: '108', description: 'Medical emergency' },
  { name: 'Fire', number: '101', description: 'Fire emergency' },
  { name: 'Women Helpline', number: '181', description: 'Women in distress' },
  { name: 'Child Helpline', number: '1098', description: 'Children in danger' },
  { name: 'Disaster Management (NDMA)', number: '1078', description: 'National disaster helpline' },
];

/** @type {Record<string, Array<{ name: string, number: string }>>} */
export const STATE_HELPLINES = {
  maharashtra: [
    { name: 'Maharashtra SDMA', number: '022-22027990' },
    { name: 'Pune Disaster Cell', number: '020-25501269' },
    { name: 'BMC Disaster', number: '1916' },
  ],
  karnataka: [
    { name: 'Karnataka SDMA', number: '080-22340676' },
  ],
  kerala: [
    { name: 'Kerala SDMA', number: '0471-2364424' },
  ],
  tamilnadu: [
    { name: 'Tamil Nadu SDMA', number: '044-28411500' },
  ],
};

/** @type {Array<{ name: string, number: string, languages: string[], description: string }>} */
export const MENTAL_HEALTH_HELPLINES = [
  { name: 'iCall (TISS)', number: '9152987821', languages: ['en', 'hi', 'mr'], description: 'Free professional counseling' },
  { name: 'Vandrevala Foundation', number: '1860-2662-345', languages: ['en', 'hi'], description: '24/7 mental health support' },
  { name: 'NIMHANS', number: '080-46110007', languages: ['en', 'hi', 'kn'], description: 'National mental health institute' },
  { name: 'Snehi', number: '044-24640050', languages: ['en', 'ta'], description: 'Emotional support helpline' },
];

/**
 * Get relevant helplines for a given state.
 * @param {string} state - State name (lowercase, e.g. 'maharashtra')
 * @returns {{ national: Array, state: Array, mentalHealth: Array }}
 */
export function getHelplinesByState(state) {
  return {
    national: NATIONAL_HELPLINES,
    state: STATE_HELPLINES[state] || [],
    mentalHealth: MENTAL_HEALTH_HELPLINES,
  };
}
