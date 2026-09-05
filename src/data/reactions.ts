// A fixed set rather than the system emoji keyboard. Five is enough to say
// something back without turning a reply into a decision, and a closed set
// means no text input, no keyboard over the video, and no 200-character
// "emoji" arriving from a crafted client -- the DB check constrains length,
// but this is what keeps the UI honest.
//
// Order matters: warmest first, since that's the one most taps land on.
export const REACTION_EMOJI = ['❤️', '😂', '🥺', '😮', '🔥'] as const;

export type ReactionEmoji = (typeof REACTION_EMOJI)[number];
