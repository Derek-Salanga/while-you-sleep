// Raw colour values. No semantics, no theme — just the hexes, written once.
//
// Nothing outside src/theme/ should import this. Screens read semantic
// tokens from useTheme(); a component reaching for `palette.blue600` is
// reaching past the abstraction that makes two themes possible.

export const palette = {
  // The two brand hues. These are the app's identity -- night blue is "you",
  // day orange is "your partner" (see the icon motif) -- and they are
  // deliberately identical in both themes. Everything else moves around them.
  blue: '#6A85F1',
  blueLight: '#8FA8FF',
  blueDark: '#4F63D1',
  blueSoft: '#DDE4FF',
  blueTint: '#EEF1FF',

  orange: '#FFC670',
  orangeLight: '#FFE0A3',
  orangeDark: '#E6A94F',
  // The record CTA's gradient end. Two jobs, and the base orange fails both:
  // it dissolves into the cream ground (1.44:1) so the button loses its right
  // edge, and it cannot carry white (1.55:1). This clears 3.12 against the
  // background and 3.32 under white -- both above the 3:1 that a UI boundary
  // and 16pt-semibold large text respectively need.
  //
  // #D47F00 was tried first and looked right, but landed at 2.89 against the
  // background. The test caught it; the eye would not have.
  orangeDeep: '#CB7A00',
  orangeSoft: '#FFEBC9',
  orangeTint: '#FFF6E8',

  // Light-theme grounds. `cream` is the day-orange hue at 96.5% lightness --
  // the "light mode is the day half" idea -- and it sits close enough to the
  // old #F5F3FA that no contrast ratio moves more than 0.07.
  cream: '#FDF7EF',
  white: '#FFFFFF',

  // Dark-theme grounds. `night` is the night-blue hue at 11.5% lightness,
  // 28% saturation: unmistakably blue rather than grey, and the brand blue
  // still reads at 5.04:1 against it so "you" never stops being visible.
  night: '#151826',
  nightRaised: '#222637',
  nightFillYou: '#2E3555',
  nightFillPartner: '#4E412C',
  nightBorder: '#666F92',

  ink: '#2E2A3D',
  inkMuted: '#5C5568',
  // #B8B2C4 was the old border and sat at 2.06:1 on white -- below the 3:1
  // WCAG needs for a UI boundary, which matters because it is the only thing
  // delimiting a text input.
  slate: '#948BA6',

  paper: '#ECEAF2',
  paperMuted: '#B2ACC0',

  // Accent-as-text variants. The brand hues themselves fail as text on light
  // grounds (blue 3.37, orange 1.41), so these are the darkened forms used
  // when a brand colour has to carry a word rather than fill a shape.
  blueOnLight: '#4F63D1',
  // Solved against the cream ground, not white: cream is fractionally
  // darker, and a value tuned on white lands just under 4.5 on it.
  orangeOnLight: '#A26100',
  // The Timeline card's 4pt edge is what encodes whose clip it is, so it has
  // to clear the 3:1 UI threshold against the background it sits on. The
  // base orange manages 1.44 there and orangeDark only 1.87.
  orangeEdgeOnLight: '#CA7900',

  danger: '#ED0000',
  dangerOnDark: '#FF9A9A',
} as const;

// Fixed surfaces: the video player and the camera viewfinder.
//
// NOT part of either theme, on purpose. These screens are dark because they
// frame moving image, not because the app is in dark mode -- a light-mode
// player wrapping a dark video is worse, and the camera preview is whatever
// happens to be in front of the lens.
//
// This also removes a real trap: ClipViewScreen currently builds its dark
// surface out of `colors.ink` as background and `colors.surface` as text.
// Under a theme those two invert and the screen becomes white-on-white.
export const media = {
  bg: '#17141F',
  text: '#FFFFFF',
  textMuted: '#C9C4D6',
  scrim: 'rgba(0,0,0,0.4)',
  scrimStrong: 'rgba(0,0,0,0.5)',
  selected: 'rgba(255,255,255,0.18)',
} as const;
