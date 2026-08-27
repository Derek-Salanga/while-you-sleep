import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Session } from '@supabase/supabase-js';
import { useMutation } from '@tanstack/react-query';
import { supabase } from './supabase';
import { usePair, useProfile } from '@/hooks/queries';
import { Pair, Profile } from '@/types';

interface PairingContextValue {
  session: Session | null;
  pair: Pair | null;
  loading: boolean;
  refreshPair: () => Promise<void>;
  myProfile: Profile | null;
  partnerProfile: Profile | null;
  refreshProfiles: () => Promise<void>;
}

const PairingContext = createContext<PairingContextValue | undefined>(
  undefined
);

export function PairingProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // `loading` only ever meant "the auth session hasn't resolved yet" --
  // RootNavigator's gate depends on that, so it stays independent of the
  // pair/profile queries below.
  const [loading, setLoading] = useState(true);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const { data: pair, refetch: refetchPair } = usePair(userId);

  const partnerId =
    pair && userId
      ? pair.user_a === userId
        ? pair.user_b
        : pair.user_a
      : null;

  const { data: myProfile, refetch: refetchMyProfile } = useProfile(userId);
  const { data: partnerProfile, refetch: refetchPartnerProfile } =
    useProfile(partnerId);

  // Idempotent: only inserts if a profile row doesn't already exist, so
  // firing it more than once for a session is harmless.
  const ensureProfile = useMutation({
    mutationFn: async (user: Session['user']) => {
      const { error } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          display_name: user.email?.split('@')[0] ?? 'Anonymous',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
      if (error) throw error;
    },
    onError: (err) => console.error('Failed to ensure profile:', err.message),
  });

  const { mutate: runEnsureProfile } = ensureProfile;
  useEffect(() => {
    if (session?.user) runEnsureProfile(session.user);
  }, [session, runEnsureProfile]);

  const refreshPair = useCallback(async () => {
    await refetchPair();
  }, [refetchPair]);

  const refreshProfiles = useCallback(async () => {
    await Promise.all([refetchMyProfile(), refetchPartnerProfile()]);
  }, [refetchMyProfile, refetchPartnerProfile]);

  const value = useMemo(
    () => ({
      session,
      pair: pair ?? null,
      loading,
      refreshPair,
      myProfile: myProfile ?? null,
      partnerProfile: partnerProfile ?? null,
      refreshProfiles,
    }),
    [
      session,
      pair,
      loading,
      refreshPair,
      myProfile,
      partnerProfile,
      refreshProfiles,
    ]
  );

  return (
    <PairingContext.Provider value={value}>{children}</PairingContext.Provider>
  );
}

export function usePairing() {
  const ctx = useContext(PairingContext);
  if (!ctx) throw new Error('usePairing must be used within PairingProvider');
  return ctx;
}
