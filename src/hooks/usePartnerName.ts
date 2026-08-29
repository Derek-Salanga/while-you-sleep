import { usePairing } from '@/lib/PairingContext';
import { usePartnerNickname } from './queries';

// The single answer to "what do I call my partner on screen".
//
// Lives outside queries.ts because it reads PairingContext, which imports
// from queries.ts -- putting it there would be a cycle.
//
// Returns null rather than a built-in fallback so callers keep the wording
// they already had: Timeline says "Your partner", StoryRings says
// "Partner", and Home drops its clause entirely rather than naming an
// unknown person. Those three had drifted apart precisely because each
// site hand-rolled its own ?? ladder.
export function usePartnerName(): string | null {
  const { session, partnerProfile } = usePairing();
  const { data: nickname } = usePartnerNickname(session?.user.id);

  // Your private nickname wins over the name they set for themselves.
  return nickname?.nickname ?? partnerProfile?.display_name ?? null;
}
