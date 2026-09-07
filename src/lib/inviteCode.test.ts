import {
  generateInviteCode,
  formatExpiry,
  inviteExpiryISO,
  CODE_ALPHABET,
  INVITE_TTL_HOURS,
} from './inviteCode';

describe('generateInviteCode', () => {
  // The point of the rewrite was the size of the space, so assert the shape
  // that gives it: 6 characters, none of them ambiguous.
  it('is six characters from the unambiguous alphabet, hyphenated', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
      for (const ch of code.replace('-', '')) {
        expect(CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it('never emits glyphs that are misread aloud or from a screenshot', () => {
    const codes = Array.from({ length: 500 }, generateInviteCode).join('');
    for (const ambiguous of ['O', '0', 'I', '1', 'L']) {
      expect(codes).not.toContain(ambiguous);
    }
  });

  // Not a randomness test -- just a guard against a generator that has
  // collapsed to a constant, which the regex above would happily pass.
  it('produces a wide spread', () => {
    const seen = new Set(Array.from({ length: 1000 }, generateInviteCode));
    expect(seen.size).toBeGreaterThan(990);
  });
});

describe('formatExpiry', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  const inHours = (h: number) =>
    new Date(now.getTime() + h * 3600_000).toISOString();

  it('describes the remaining window coarsely', () => {
    expect(formatExpiry(inHours(72), now)).toBe('Expires in 3 days');
    expect(formatExpiry(inHours(25), now)).toBe('Expires in 1 day');
    expect(formatExpiry(inHours(5), now)).toBe('Expires in 5 hours');
    expect(formatExpiry(inHours(1), now)).toBe('Expires in 1 hour');
    expect(formatExpiry(inHours(0.2), now)).toBe('Expires in under an hour');
  });

  it('reports an elapsed window as expired rather than a negative one', () => {
    expect(formatExpiry(inHours(-1), now)).toBe('Expired');
  });

  // Rows created before the column existed carry null, and join_pair_by_code
  // treats those as never expiring -- so the UI must show nothing, not
  // "Expired".
  it('renders nothing when there is no expiry', () => {
    expect(formatExpiry(null, now)).toBeNull();
    expect(formatExpiry(undefined, now)).toBeNull();
  });
});

describe('inviteExpiryISO', () => {
  it('is the configured TTL ahead of now', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    expect(inviteExpiryISO(now)).toBe('2026-06-04T12:00:00.000Z');
    expect(INVITE_TTL_HOURS).toBe(72);
  });
});
