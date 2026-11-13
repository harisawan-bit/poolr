const openings = [
  ['Good morning', 'Morning', 'Hello, early bird!', 'A fresh morning', 'Rise and shine', 'Bright and early',
    'Morning, researcher!', 'A new day', 'Up with the sun', 'Hello from the morning shift', 'A quiet morning', 'Welcome this morning'],
  ['Good afternoon', 'Afternoon', 'Hello this afternoon', 'Back at it', 'A good day for a review', 'Hello, midday researcher!',
    'Welcome this afternoon', 'Afternoon check-in', 'Here for the afternoon', 'The afternoon is yours', 'Hello again', 'Back for another look'],
  ['Good evening', 'Evening', 'Hello this evening', 'Welcome this evening', 'An evening for evidence', 'Hello, evening researcher!',
    'A quiet evening', 'Here for the evening', 'Back after hours', 'Evening check-in', 'One more look this evening', 'Welcome back this evening'],
  ['Hello, night owl!', 'Good to see you after dark', 'Welcome to the night shift', 'Hello from the quiet hours', 'Late-night hello', 'The night is yours',
    'Good to see you up late', 'Hello, midnight researcher!', 'A quiet night', 'Still up?', 'Welcome back, night owl!', 'After-hours check-in'],
];

const notes = [
  'Pick up where you left off.', 'A small step still moves the review forward.', 'Your review is ready when you are.',
  'Choose one task to finish this session.', 'A quick check of the protocol can clarify the next step.',
  'Check the screening queue before running another search.', 'Record a search strategy while it’s fresh.',
  'Leave a note on any decision you want to revisit.', 'Make the next step easy for your future self.',
  'Review the evidence one record at a time.', 'Start with the question your review needs to answer.',
  'Use the workflow below to jump to the section you need.',
];

export const greetingVariantsPerPeriod = openings[0].length * notes.length;

export function greetingPeriod(hour: number) {
  if (hour >= 5 && hour < 12) return 0;
  if (hour >= 12 && hour < 18) return 1;
  if (hour >= 18 && hour < 22) return 2;
  return 3;
}

export function dashboardGreeting(period: number, visit: number, name?: string) {
  const index = ((visit % greetingVariantsPerPeriod) + greetingVariantsPerPeriod) % greetingVariantsPerPeriod;
  const phrase = openings[period][index % openings[period].length];
  const person = name?.trim();
  const title = person ? (/[!?]$/.test(phrase) ? `${phrase} Good to see you, ${person}.` : `${phrase}, ${person}`) : phrase;
  return { title, note: notes[Math.floor(index / openings[period].length)] };
}
