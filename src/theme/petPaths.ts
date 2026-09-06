// The pet, as vector. One body drawn twice under a left/right clip so each
// half takes a partner's colour -- the same "crossover split" technique
// CrossoverHeart.tsx uses for the app icon's motif, and the convention
// colors.ts documents: day-orange is your partner, night-blue is you.
//
// 100x100 viewBox, symmetric about x=50. The symmetry is load-bearing, not
// tidiness: the body is clipped into halves at exactly x=50, so any
// asymmetry gives one partner a visibly larger half.
//
// The silhouette carries an outline in every mood (see Pet.tsx). That's what
// lets the most subdued state use a near-invisible fill without the pet
// disappearing -- the shape is held by the stroke, and only the warmth
// drains out.

// Body plus two ears plus two feet, as subpaths in one string. They can
// share a path because the clip splits by geometry, not by subpath.
export const PET_BODY =
  // left ear
  'M36.5 22.5 C33.5 17.0 34.8 11.5 40.5 10.5 C43.8 10.0 46.8 11.6 48.0 14.8 ' +
  'C43.9 14.5 40.1 17.8 36.5 22.5 Z ' +
  // right ear
  'M63.5 22.5 C66.5 17.0 65.2 11.5 59.5 10.5 C56.2 10.0 53.2 11.6 52.0 14.8 ' +
  'C56.1 14.5 59.9 17.8 63.5 22.5 Z ' +
  // body, with a foot flicking out at each side of the base
  'M50.0 21.5 C59.0 21.5 66.5 24.5 71.0 30.5 C75.0 35.8 77.5 42.8 78.4 50.0 ' +
  'C79.5 60.0 76.2 69.3 70.3 76.0 C68.8 81.0 69.6 84.7 72.0 87.0 ' +
  'C68.0 87.0 64.8 84.8 63.5 81.2 C59.9 83.9 55.2 85.5 50.0 85.5 ' +
  'C44.8 85.5 40.1 83.9 36.5 81.2 C35.2 84.8 32.0 87.0 28.0 87.0 ' +
  'C30.4 84.7 31.2 81.0 29.7 76.0 C23.8 69.3 20.5 60.0 21.6 50.0 ' +
  'C22.5 42.8 25.0 35.8 29.0 30.5 C33.5 24.5 41.0 21.5 50.0 21.5 Z';

// Eyes and mouth are strokes, not fills -- a few short paths per mood
// instead of four separate illustrations. Body geometry is identical across
// all four; only the face moves.
//
// Nothing here frowns. The moods read as *waiting*, not suffering: a pet
// that looks hurt turns "we got busy" back into "you failed it", which is
// the exact dynamic this feature exists to avoid. Even `withdrawn` keeps a
// level mouth rather than a downturned one.
export const PET_EYES: Record<string, string> = {
  thriving: 'M38.0 48.0 Q42.0 44.0 46.0 48.0 M54.0 48.0 Q58.0 44.0 62.0 48.0',
  content:
    'M38.5 47.0 C38.5 44.8 40.2 43.2 42.0 43.2 C43.8 43.2 45.5 44.8 45.5 47.0 ' +
    'C45.5 49.2 43.8 50.8 42.0 50.8 C40.2 50.8 38.5 49.2 38.5 47.0 Z ' +
    'M54.5 47.0 C54.5 44.8 56.2 43.2 58.0 43.2 C59.8 43.2 61.5 44.8 61.5 47.0 ' +
    'C61.5 49.2 59.8 50.8 58.0 50.8 C56.2 50.8 54.5 49.2 54.5 47.0 Z',
  // heavy lids: an upper line with a smaller one tucked under it
  sleepy:
    'M37.8 45.8 Q42.0 43.8 46.2 45.8 M39.2 48.0 Q42.0 48.8 44.8 48.0 ' +
    'M53.8 45.8 Q58.0 43.8 62.2 45.8 M55.2 48.0 Q58.0 48.8 60.8 48.0',
  withdrawn: 'M38.0 47.5 Q42.0 49.0 46.0 47.5 M54.0 47.5 Q58.0 49.0 62.0 47.5',
};

export const PET_MOUTH: Record<string, string> = {
  thriving: 'M37.5 59.0 Q50.0 69.5 62.5 59.0',
  content: 'M41.0 60.0 Q50.0 65.5 59.0 60.0',
  sleepy: 'M42.5 60.5 Q50.0 64.0 57.5 60.5',
  withdrawn: 'M44.0 61.2 Q50.0 62.0 56.0 61.2',
};

// Pause overlay, not a fifth mood. Pause is a status -- "we're travelling"
// -- so it sits on top of whatever mood is current rather than replacing it,
// and must never read as a worse state of wellbeing.
export const PET_SLEEP_MARK = 'M80,20 L89,20 L80,30 L89,30';
