import React, { useCallback } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { PairProvider, usePairContext } from './PairContext';

export function PairingProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PairProvider>{children}</PairProvider>
    </AuthProvider>
  );
}

// Preserves the pre-split usePairing() shape so none of its consumers
// (RootNavigator + 6 screens) need to change: session/loading/myProfile
// come from AuthContext, pair/partnerProfile from PairContext (which needs
// auth's userId to derive partnerId), composed together here.
export function usePairing() {
  const { session, loading, myProfile, refreshMyProfile } = useAuth();
  const { pair, refreshPair, partnerProfile, refreshPartnerProfile } =
    usePairContext();

  const refreshProfiles = useCallback(async () => {
    await Promise.all([refreshMyProfile(), refreshPartnerProfile()]);
  }, [refreshMyProfile, refreshPartnerProfile]);

  return {
    session,
    pair,
    loading,
    refreshPair,
    myProfile,
    partnerProfile,
    refreshProfiles,
  };
}
