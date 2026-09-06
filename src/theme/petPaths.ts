// The pet, as vector. One body drawn twice under a left/right clip so each
// half takes a partner's colour -- the same "crossover split" technique
// CrossoverHeart.tsx uses for the app icon's motif, and the convention
// colors.ts documents: day-orange is your partner, night-blue is you.
//
// 100x100 viewBox, symmetric about x=50. The symmetry is load-bearing, not
// tidiness: the body is clipped into halves at exactly that line, so any
// asymmetry hands one partner a visibly larger half.
//
// PET_BODY NEVER CHANGES BETWEEN MOODS. Only the eyes and mouth move. If a
// future mood needs a different silhouette, it isn't a mood -- it's a second
// creature, and the split would have to be re-checked.

export const PET_BODY =
  'M34.0 25.0 ' +
  'C27.7 21.4 21.0 22.2 17.8 27.1 ' +
  'C14.5 32.1 16.2 39.8 21.6 43.3 ' +
  'C25.2 45.6 29.4 44.8 32.4 41.8 ' +
  'C30.2 46.2 29.4 50.2 30.3 54.2 ' +
  'C26.6 55.3 24.3 57.8 24.5 61.0 ' +
  'C24.7 64.2 27.1 66.5 30.3 66.8 ' +
  'C27.2 70.0 26.3 73.9 27.8 77.3 ' +
  'C29.1 80.3 32.0 82.0 35.2 81.8 ' +
  'C35.0 85.7 37.5 88.8 41.0 89.2 ' +
  'C44.4 89.6 47.0 87.9 50.0 85.0 ' +
  'C53.0 87.9 55.6 89.6 59.0 89.2 ' +
  'C62.5 88.8 65.0 85.7 64.8 81.8 ' +
  'C68.0 82.0 70.9 80.3 72.2 77.3 ' +
  'C73.7 73.9 72.8 70.0 69.7 66.8 ' +
  'C72.9 66.5 75.3 64.2 75.5 61.0 ' +
  'C75.7 57.8 73.4 55.3 69.7 54.2 ' +
  'C70.6 50.2 69.8 46.2 67.6 41.8 ' +
  'C70.6 44.8 74.8 45.6 78.4 43.3 ' +
  'C83.8 39.8 85.5 32.1 82.2 27.1 ' +
  'C79.0 22.2 72.3 21.4 66.0 25.0 ' +
  'C61.8 20.6 56.1 18.5 50.0 18.5 ' +
  'C43.9 18.5 38.2 20.6 34.0 25.0 Z';

// Eyes and mouth are strokes, not fills -- a few short paths per mood
// instead of four separate illustrations.
//
// Nothing here frowns, and that is deliberate rather than a style choice.
// The moods must read as *waiting*, not suffering: a pet that looks hurt
// turns "we got busy" back into "you failed it", which is the exact dynamic
// this feature exists to avoid. Even `withdrawn` keeps a level mouth.
export const PET_EYES: Record<string, string> = {
  thriving: 'M37.8 47.0 Q42.0 42.6 46.2 47.0 M53.8 47.0 Q58.0 42.6 62.2 47.0',
  content:
    'M39.5 46.0 ' +
    'C39.5 43.3 41.0 41.5 43.0 41.5 ' +
    'C45.0 41.5 46.5 43.3 46.5 46.0 ' +
    'C46.5 48.7 45.0 50.5 43.0 50.5 ' +
    'C41.0 50.5 39.5 48.7 39.5 46.0 Z ' +
    'M53.5 46.0 ' +
    'C53.5 43.3 55.0 41.5 57.0 41.5 ' +
    'C59.0 41.5 60.5 43.3 60.5 46.0 ' +
    'C60.5 48.7 59.0 50.5 57.0 50.5 ' +
    'C55.0 50.5 53.5 48.7 53.5 46.0 Z',
  // heavy lids: an upper line with a smaller one tucked beneath it
  sleepy:
    'M37.8 46.0 Q42.0 44.2 46.2 46.0 ' +
    'M39.4 48.2 Q42.0 49.1 44.6 48.2 ' +
    'M53.8 46.0 Q58.0 44.2 62.2 46.0 ' +
    'M55.4 48.2 Q58.0 49.1 60.6 48.2',
  withdrawn: 'M38.2 47.5 Q42.0 49.5 45.8 47.5 M54.2 47.5 Q58.0 49.5 61.8 47.5',
};

export const PET_MOUTH: Record<string, string> = {
  thriving: 'M41.0 57.5 Q45.0 63.5 50.0 60.0 Q55.0 63.5 59.0 57.5',
  content: 'M42.0 59.0 Q46.0 62.5 50.0 59.8 Q54.0 62.5 58.0 59.0',
  sleepy: 'M43.5 60.0 Q46.8 62.0 50.0 60.5 Q53.2 62.0 56.5 60.0',
  withdrawn: 'M44.5 60.7 Q47.2 61.8 50.0 60.9 Q52.8 61.8 55.5 60.7',
};

// Deliberately off-palette: this is the artwork's own line colour, a softer
// grey than colors.ink (#2E2A3D), and the face reads as drawn rather than
// stamped with UI ink. Noted because CLAUDE.md otherwise locks the palette.
export const PET_LINE = '#554B66';

// Pause overlay, not a fifth mood. Pause is a status -- "we're travelling"
// -- so it sits on top of whatever mood is current rather than replacing it,
// and must never read as a worse state of wellbeing.
export const PET_SLEEP_MARK = 'M80,20 L89,20 L80,30 L89,30';
