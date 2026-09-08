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
  // Text placed ON a brand fill, over `brandScrim`. The brand hues do not
  // change between themes, so neither does this -- see `brand` below.
  textOnBrand: string;

  border: string;

  // The you/partner pair as *accents* -- small coloured elements and text.
  // These differ per theme because the brand hues themselves fail as text
  // on a light ground (blue 3.37:1, orange 1.41:1) but read comfortably on
  // a dark one.
  accentYou: string;
  accentPartner: string;

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
  // A deepened blue, kept for anywhere a solid brand fill needs to carry
  // white text without a scrim (white reaches 5.20 here against 3.37 on the
  // base hue).
  youDeep: palette.blueDark,
} as const;

export { brandScrim, brandScrimOver } from './palette';

export const lightTheme: Theme = {
  name: 'light',
  background: palette.cream,
  surface: palette.white,
  textPrimary: palette.ink,
  textMuted: palette.inkMuted,
  textOnBrand: palette.white,
  border: palette.slate,
  accentYou: palette.blueOnLight,
  accentPartner: palette.orangeOnLight,
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
  textOnBrand: palette.white,
  border: palette.nightBorder,
  // On a dark ground the brand hues are legible as text, so the accents go
  // back to being the brand colours rather than darkened stand-ins.
  accentYou: palette.blueLight,
  accentPartner: palette.orange,
  fillYou: palette.nightFillYou,
  fillPartner: palette.nightFillPartner,
  edgeYou: palette.blue,
  edgePartner: palette.orange,
  danger: palette.dangerOnDark,
};

export { media } from './palette';
