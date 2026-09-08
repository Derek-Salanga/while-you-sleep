import { Theme, lightTheme, darkTheme, brand, media } from './themes';

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
    [t.accent, t.surface, BODY, 'accent text on a card'],
    [t.accentPartner, t.surface, BODY, 'partner accent text on a card'],
    [t.accent, t.background, BODY, 'accent text on the background'],
    [t.accentPartner, t.background, BODY, 'partner accent on the background'],
    [t.danger, t.surface, BODY, 'destructive text'],
    [t.textOnAccent, t.accent, BODY, 'primary button label'],
    [t.textPrimary, t.fillPartner, BODY, 'secondary button label'],
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
// colours are fixed too. This is the pairing with no single answer: white
// clears 4.5 on the deepened blue and manages 1.55 on the orange; ink is the
// reverse. Each half therefore carries its own, which works only because the
// text is already segregated by half.
describe('brand fills', () => {
  it('each half carries text that clears body contrast', () => {
    expect(
      contrast(lightTheme.textOnYou, brand.youDeep)
    ).toBeGreaterThanOrEqual(BODY);
    expect(
      contrast(lightTheme.textOnPartner, brand.partner)
    ).toBeGreaterThanOrEqual(BODY);
  });

  // Guards why the halves differ at all. If this ever starts passing, the
  // palette has drifted and HeroCard could go back to one text colour.
  it('white on the bare day-orange is still the failure that forces this', () => {
    expect(contrast(lightTheme.textOnYou, brand.partner)).toBeLessThan(LARGE);
  });

  // The CTA is a solid `accent` fill in both themes, and `accent` flips hue
  // so the button always stands off its ground. Both directions are covered
  // by the token table above (textOnAccent / accent); this asserts the other
  // half of the job -- that the fill itself separates from the background.
  it('the CTA fill separates from its background in both themes', () => {
    expect(
      contrast(lightTheme.accent, lightTheme.background)
    ).toBeGreaterThanOrEqual(LARGE);
    expect(
      contrast(darkTheme.accent, darkTheme.background)
    ).toBeGreaterThanOrEqual(LARGE);
  });
});
