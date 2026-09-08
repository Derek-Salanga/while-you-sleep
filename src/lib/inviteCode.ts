// Invite code lifetime, and the reference generator.
//
// GENERATION MOVED SERVER-SIDE on 2026-09-08 (generate_invite_code in
// supabase/schema.sql). generateInviteCode below is no longer called by the
// app: it is kept as the executable spec of the alphabet and shape, and its
// tests are what stop the two drifting. If you change one, change both.
//
// It moved because whoever generates the code also sees the collision, and a
// visible unique violation answers "is this code live right now?" -- an
// enumeration oracle that defeated the attempt ceiling on joining.

// How long a fresh invite stays claimable. Long enough to send it and have
// your partner get round to it; short enough that a code you shared and
// forgot doesn't stay live indefinitely. Enforced server-side in
// join_pair_by_code -- this value only decides what the client writes.
export const INVITE_TTL_HOURS = 72;

// Ambiguous glyphs removed: no O/0, no I/1/L. These codes get read aloud and
// typed from a screenshot, and "was that an O or a zero" is the failure that
// makes someone give up on pairing.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

// e.g. "K7M-P2Q". 31^6 is ~887 million, which with the server-side attempt
// ceiling puts guessing out of reach while still being something you can say
// down a phone.
export function generateInviteCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${out.slice(0, 3)}-${out.slice(3)}`;
}

// Deliberately coarse. An invite is not a countdown timer -- "expires in 2
// days" is what you need to decide whether to resend it, and a live
// second-by-second figure would just be motion on a screen you're waiting on.
export function formatExpiry(
  iso: string | null | undefined,
  now: Date = new Date()
): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return 'Expired';
  const hours = Math.round(ms / 3600_000);
  if (hours < 1) return 'Expires in under an hour';
  if (hours < 24) return `Expires in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `Expires in ${days} day${days === 1 ? '' : 's'}`;
}
