import {
  Theme,
  lightTheme,
  darkTheme,
  brand,
  brandScrimOver,
  media,
} from './themes';

// WCAG 2.x relative luminance. Written here rather than imported because
// this is the only thing that needs it, and a colour library would be a
// dependency to check twenty numbers.
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const BODY = 4.5; // WCAG AA, normal text
const LARGE = 3.0; // AA for >=18pt, or >=14pt bold -- and for UI boundaries

// Every combination the app actually puts on screen. This list is the
// audit; if a component starts pairing two tokens that aren't here, add the
// pair rather than assuming it's fine.
function combinations(t: Theme): [string, string, number, string][] {
  return [
    [t.textPrimary, t.background, BODY, 'body text on the app background'],
    [t.textPrimary, t.surface, BODY, 'body text on a card'],
    [t.textMuted, t.background, BODY, 'secondary text on the background'],
    [t.textMuted, t.surface, BODY, 'secondary text on a card'],
    [t.textPrimary, t.fillYou, BODY, 'Timeline "you" card text'],
    [t.textPrimary, t.fillPartner, BODY, 'Timeline "partner" card text'],
    [t.textMuted, t.fillYou, BODY, 'Timeline "you" card date'],
    [t.textMuted, t.fillPartner, BODY, 'Timeline "partner" card date'],
    [t.accentYou, t.surface, BODY, 'accent text on a card'],
    [t.accentPartner, t.surface, BODY, 'partner accent text on a card'],
    [t.accentYou, t.background, BODY, 'accent text on the background'],
    [t.accentPartner, t.background, BODY, 'partner accent on the background'],
    [t.danger, t.surface, BODY, 'destructive text'],
    // 3:1 because a border is a UI boundary, not text -- and on an Input it
    // is the only thing saying where the field is.
    [t.border, t.surface, LARGE, 'card / input border'],
    [t.border, t.background, LARGE, 'border against the background'],
    // The 4pt edge is what actually encodes whose clip a card is, so it has
    // to survive against the background even though the fill need not.
    [t.edgeYou, t.background, LARGE, '"you" card edge'],
    [t.edgePartner, t.background, LARGE, '"partner" card edge'],
  ];
}

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('%s theme', (_name, theme) => {
  it.each(combinations(theme))(
    '%s on %s meets %s:1 — %s',
    (fg, bg, threshold, _why) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(threshold);
    }
  );

  it('has the same keys as the other theme', () => {
    const other = theme.name === 'light' ? darkTheme : lightTheme;
    expect(Object.keys(theme).sort()).toEqual(Object.keys(other).sort());
  });
});

// These are not theme tokens and must never become them -- the player and
// the viewfinder are dark because they frame moving image, not because the
// app is in dark mode.
describe('fixed media surfaces', () => {
  it('carries readable text regardless of theme', () => {
    expect(contrast(media.text, media.bg)).toBeGreaterThanOrEqual(BODY);
    expect(contrast(media.textMuted, media.bg)).toBeGreaterThanOrEqual(BODY);
  });
});

// HeroCard fills its halves with the brand hues in both themes, so its text
// colours are fixed too. White on the day-orange is 1.55:1 -- the worst
// combination in the app -- so text there sits over `brandScrim`, and these
// assert the composited result rather than the raw hue.
describe('brand fills', () => {
  it('white clears body contrast over the scrim on both halves', () => {
    expect(
      contrast(lightTheme.textOnBrand, brandScrimOver.you)
    ).toBeGreaterThanOrEqual(BODY);
    expect(
      contrast(lightTheme.textOnBrand, brandScrimOver.partner)
    ).toBeGreaterThanOrEqual(BODY);
  });

  // Guards the reason the scrim exists: without it white fails on the orange
  // by a margin no tuning closes. If this ever starts passing, the palette
  // has drifted and the scrim may no longer be needed.
  it('white on the bare orange is still the failure the scrim exists for', () => {
    expect(contrast(lightTheme.textOnBrand, brand.partner)).toBeLessThan(LARGE);
  });

  // The record button's gradient runs between the two brand hues, so its
  // label sits on every colour in between. Ink is the only one that survives
  // the orange end, and the label is 16pt semibold = WCAG large.
  it('an ink gradient label clears large-text contrast at both ends', () => {
    expect(contrast(lightTheme.textPrimary, brand.you)).toBeGreaterThanOrEqual(
      LARGE
    );
    expect(
      contrast(lightTheme.textPrimary, brand.partner)
    ).toBeGreaterThanOrEqual(LARGE);
  });
});
