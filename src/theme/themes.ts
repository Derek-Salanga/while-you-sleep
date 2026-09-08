import { palette } from './palette';

// Semantic tokens. Both themes carry an identical key set, which is what
// makes a component able to read `theme.textMuted` without knowing or
// caring which theme is active.
//
// Names describe the ROLE, never the colour. `accentYou` rather than
// `blue`, because in a future theme it might not be blue -- and because a
// component asking for "blue" is a component that will be wrong the moment
// anything changes.
export interface Theme {
  name: 'light' | 'dark';

  background: string;
  surface: string;

  textPrimary: string;
  textMuted: string;
  // Text placed ON a brand fill. Two tokens rather than one because no
  // single colour clears 4.5:1 on both hues: white gets 5.20 on the deepened
  // blue and 1.55 on the orange, ink is the reverse. The brand hues don't
  // change between themes, so neither do these.
  textOnYou: string;
  textOnPartner: string;

  border: string;

  // The you/partner pair as *accents* -- small coloured elements and text.
  // These differ per theme because the brand hues themselves fail as text
  // on a light ground (blue 3.37:1, orange 1.41:1) but read comfortably on
  // a dark one.
  accentYou: string;
  accentPartner: string;
  // Text on a solid `accentYou` fill -- a primary button. Flips between the
  // themes because accentYou itself does: the light accent is dark enough
  // to carry white (5.20), the dark accent is light enough to need ink
  // (6.08). One token, opposite values, which is the whole reason it exists
  // rather than being hardcoded at the call site.
  textOnAccent: string;

  // Card washes, and the edges that carry the actual meaning. The fills are
  // decorative and sit at low contrast against the background by design;
  // the 4pt edge is full-strength and is what tells you whose clip it is.
  fillYou: string;
  fillPartner: string;
  edgeYou: string;
  edgePartner: string;

  danger: string;
}

// Theme-independent. The brand hues are the identity: the crossover heart,
// the pet's two halves, HeroCard's split and the record button's gradient
// all encode "you" and "your partner" in these exact values, and a theme
// that moved them would be a different app rather than a darker one.
export const brand = {
  you: palette.blue,
  partner: palette.orange,
  // HeroCard's left half. White text needs 4.5:1 and gets 3.37 on the base
  // blue -- enough for the 28pt count, which is WCAG large, but not the 16pt
  // caption beside it. On this it gets 5.20.
  youDeep: palette.blueDark,
  // Used only for the record CTA's gradient -- see the note in palette.ts.
  // The circular record button in RecordScreen keeps the true hues, since it
  // carries no text and sits over a camera preview rather than a page.
  partnerDeep: palette.orangeDeep,
} as const;

export const lightTheme: Theme = {
  name: 'light',
  background: palette.cream,
  surface: palette.white,
  textPrimary: palette.ink,
  textMuted: palette.inkMuted,
  textOnYou: palette.white,
  textOnPartner: palette.ink,
  border: palette.slate,
  accentYou: palette.blueOnLight,
  accentPartner: palette.orangeOnLight,
  textOnAccent: palette.white,
  fillYou: palette.blueSoft,
  fillPartner: palette.orangeSoft,
  edgeYou: palette.blue,
  edgePartner: palette.orangeEdgeOnLight,
  danger: palette.danger,
};

export const darkTheme: Theme = {
  name: 'dark',
  background: palette.night,
  surface: palette.nightRaised,
  textPrimary: palette.paper,
  textMuted: palette.paperMuted,
  textOnYou: palette.white,
  textOnPartner: palette.ink,
  border: palette.nightBorder,
  // On a dark ground the brand hues are legible as text, so the accents go
  // back to being the brand colours rather than darkened stand-ins.
  accentYou: palette.blueLight,
  accentPartner: palette.orange,
  textOnAccent: palette.ink,
  fillYou: palette.nightFillYou,
  fillPartner: palette.nightFillPartner,
  edgeYou: palette.blue,
  edgePartner: palette.orange,
  danger: palette.dangerOnDark,
};

export { media } from './palette';
