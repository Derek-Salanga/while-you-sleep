// Bundled prompt pool for the Daily Question feature. Selecting by date
// (rather than randomly per-request) means both partners always see the
// same prompt on a given day without any server-side scheduling.
export const dailyQuestions: string[] = [
  'What made you smile today?',
  'What are you looking forward to this week?',
  'What song has been stuck in your head?',
  "What's one thing you want to do together when you're next in the same place?",
  'What was the best thing you ate today?',
  'What is something small I did that you appreciated?',
  "What's a memory of us you found yourself thinking about recently?",
  'If we were together right now, what would you want to do?',
  'What is something new you learned this week?',
  'What are you grateful for today?',
  'What is a place you want to travel to together?',
  "What's something that stressed you out today, big or small?",
  'What is your favorite photo of us and why?',
  'What is something you want to tell me but keep forgetting to?',
  "What's a habit you're trying to build or break right now?",
  'What was the highlight of your day?',
  'What is something you miss most about being close to me?',
  "What's a show, movie, or book you think I'd like right now?",
  'What is a goal you have for the next month?',
  'What made today different from yesterday?',
];

export function getQuestionForDate(dateStr: string): string {
  // dayNumber is days since the epoch for any real calendar date this
  // app passes in, so it's always non-negative — a plain modulo is
  // enough, no wraparound guard needed.
  const dayNumber = Math.floor(
    new Date(`${dateStr}T00:00:00Z`).getTime() / 86_400_000
  );
  return dailyQuestions[dayNumber % dailyQuestions.length];
}
