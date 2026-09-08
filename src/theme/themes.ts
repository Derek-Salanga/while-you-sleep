import { palette } from './palette';

// Semantic tokens. Both themes carry an identical key set, which is what
// makes a component able to read `theme.textMuted` without knowing or
// caring which theme is active.
//
// Names describe the ROLE, never the colour. `accent` rather than
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

  // The app's action colour: the record CTA, primary buttons, the active tab
  // icon, links. NOT a you/partner colour -- it deliberately takes the hue
  // *opposite* the ambient theme, so the thing you're meant to tap always
  // stands off the ground. Blue on the day-lit theme, orange on the night
  // one.
  //
  // It was called accentYou until the flip made that a lie. The you/partner
  // meaning lives on the Timeline card edges, HeroCard's halves, the heart
  // and the pet -- none of which move with the theme.
  accent: string;
  // The partner hue as *text* on a light ground, where the base orange
  // manages 1.41:1. Used where something must read as the partner's rather
  // than as an action.
  accentPartner: string;
  // Text on a solid `accent` fill. Flips with it: the light accent is a deep
  // blue that carries white (5.20), the dark accent is the day-orange, which
  // carries only ink (8.95). One token, opposite values -- the whole reason
  // it exists rather than a hardcoded white at the call site.
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
  accent: palette.blueOnLight,
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
  // The day-orange, on the night-blue ground. Reads at 10.95:1 against it,
  // which is why the action colour flips rather than staying blue: a blue
  // button on a blue-black page is the thing you'd have to hunt for.
  accent: palette.orange,
  accentPartner: palette.orange,
  textOnAccent: palette.ink,
  fillYou: palette.nightFillYou,
  fillPartner: palette.nightFillPartner,
  edgeYou: palette.blue,
  edgePartner: palette.orange,
  danger: palette.dangerOnDark,
};

export { media } from './palette';
