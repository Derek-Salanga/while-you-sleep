import { readFileSync } from 'fs';
import { join } from 'path';
import {
  generateInviteCode,
  formatExpiry,
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

// The generator that actually runs is generate_invite_code() in
// supabase/schema.sql -- it moved server-side so that a unique violation is
// never visible to a client, since a visible one answers "is this code live?"
// The version in this file is now the executable spec, and these assert the
// two have not drifted apart. A silent divergence would mean codes that read
// differently depending on which path created them, and an alphabet that
// quietly reintroduces the ambiguous glyphs.
describe('the schema generator matches this one', () => {
  const schema = readFileSync(
    join(__dirname, '../../supabase/schema.sql'),
    'utf8'
  );

  it('uses the same alphabet', () => {
    const match = schema.match(/alphabet constant text := '([^']+)'/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(CODE_ALPHABET);
  });

  it('uses the same TTL default', () => {
    const match = schema.match(/create_invite\(ttl_hours int default (\d+)\)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(INVITE_TTL_HOURS);
  });

  it('still generates six characters in two groups of three', () => {
    expect(schema).toMatch(/for i in 1\.\.6 loop/);
    expect(schema).toMatch(
      /substr\(out, 1, 3\) \|\| '-' \|\| substr\(out, 4, 3\)/
    );
  });
});
