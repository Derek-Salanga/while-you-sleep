// The pet, as vector. One body drawn twice under a left/right clip so each
// half takes a partner's colour -- the same "crossover split" technique
// CrossoverHeart.tsx uses for the app icon's motif, and the same convention
// colors.ts documents: day-orange is your partner, night-blue is you.
//
// A creature rather than an abstract shape because the whole mechanic rests
// on it reading as something you'd rather not leave hungry. Ears and a
// rounded body do that; a circle with a face doesn't.
//
// 100x100 viewBox, symmetric about x=50 so the split lands cleanly down the
// middle and neither partner gets the larger half.

// Body plus two ears, as three subpaths in one string. They can share a
// path because the clip splits by geometry, not by subpath.
export const PET_BODY =
  // rounded body, slightly wider at the base so it sits rather than floats
  'M50,26 C33,26 24,41 24,57 C24,75 35,89 50,89 C65,89 76,75 76,57 ' +
  'C76,41 67,26 50,26 Z ' +
  // left ear
  'M33,31 C28,21 35,14 42,20 C38,23 35,27 33,31 Z ' +
  // right ear
  'M67,31 C72,21 65,14 58,20 C62,23 65,27 67,31 Z';

// Eyes and mouth are strokes, not fills -- a few short paths per mood
// instead of four separate illustrations. Everything below is drawn on top
// of the split body, so it reads the same on either half.
//
// Nothing here frowns. The moods are meant to read as *waiting*, not
// suffering: a pet that looks hurt turns "we got busy" back into "you failed
// it", which is the exact dynamic this feature exists to avoid.
export const PET_EYES: Record<string, string> = {
  // curved up: eyes closed in pleasure, the classic content-animal face
  thriving: 'M34,53 Q40,46 46,53 M54,53 Q60,46 66,53',
  // open and alert
  content: 'M40,49 L40,55 M60,49 L60,55',
  // half-lidded, flat
  sleepy: 'M35,52 L45,52 M55,52 L65,52',
  // closed and drooping slightly -- tired, not sad
  withdrawn: 'M35,51 Q40,55 45,51 M55,51 Q60,55 65,51',
};

export const PET_MOUTH: Record<string, string> = {
  thriving: 'M40,64 Q50,73 60,64',
  content: 'M44,66 Q50,70 56,66',
  sleepy: 'M46,67 L54,67',
  withdrawn: 'M47,68 L53,68',
};

// Pause overlay, not a fifth mood. Pause is a status -- "we're travelling"
// -- so it must not read as a worse state of wellbeing; it sits on top of
// whatever mood is current rather than replacing it.
export const PET_SLEEP_MARK = 'M78,26 L88,26 L78,36 L88,36';
