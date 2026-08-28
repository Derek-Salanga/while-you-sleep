import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { usePair, useProfile } from '@/hooks/queries';
import { Pair, Profile } from '@/types';
import { useAuth } from './AuthContext';

interface PairContextValue {
  pair: Pair | null;
  refreshPair: () => Promise<void>;
  partnerProfile: Profile | null;
  refreshPartnerProfile: () => Promise<void>;
}

const PairContext = createContext<PairContextValue | undefined>(undefined);

export function PairProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const { data: pair, refetch: refetchPair } = usePair(userId);

  const partnerId =
    pair && userId
      ? pair.user_a === userId
        ? pair.user_b
        : pair.user_a
      : null;

  const { data: partnerProfile, refetch: refetchPartnerProfile } =
    useProfile(partnerId);

  const refreshPair = useCallback(async () => {
    await refetchPair();
  }, [refetchPair]);

  const refreshPartnerProfile = useCallback(async () => {
    await refetchPartnerProfile();
  }, [refetchPartnerProfile]);

  const value = useMemo(
    () => ({
      pair: pair ?? null,
      refreshPair,
      partnerProfile: partnerProfile ?? null,
      refreshPartnerProfile,
    }),
    [pair, refreshPair, partnerProfile, refreshPartnerProfile]
  );

  return <PairContext.Provider value={value}>{children}</PairContext.Provider>;
}

export function usePairContext() {
  const ctx = useContext(PairContext);
  if (!ctx) throw new Error('usePairContext must be used within PairProvider');
  return ctx;
}
