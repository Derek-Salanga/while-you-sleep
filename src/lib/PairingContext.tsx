import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
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

// Supabase project can cold-start with a few seconds of clock drift
// (e.g. waking from free-tier auto-pause), which makes PostgREST briefly
// reject an otherwise-valid JWT as "issued at future". It self-corrects
// within a couple seconds, so retry rather than giving up immediately.
async function withClockSkewRetry(
  run: () => Promise<{ error: { message: string } | null }>,
  retries = 2,
  delayMs = 1500
): Promise<{ error: { message: string } | null }> {
  for (let attempt = 0; ; attempt++) {
    const result = await run();
    const isClockSkew = result.error?.message.includes(
      'JWT issued at future'
    );
    if (!isClockSkew || attempt >= retries) return result;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

export function PairingProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [pair, setPair] = useState<Pair | null>(null);
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);

  const refreshPair = useCallback(async () => {
    if (!session?.user) {
      setPair(null);
      return;
    }
    let latestData: Pair | null = null;
    const { error } = await withClockSkewRetry(async () => {
      const { data, error } = await supabase
        .from('pairs')
        .select('*')
        .or(`user_a.eq.${session.user.id},user_b.eq.${session.user.id}`)
        .maybeSingle();
      latestData = data ?? null;
      return { error };
    });

    if (error) {
      console.error('Failed to load pair:', error.message);
      return;
    }
    setPair(latestData);
  }, [session]);

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

  const ensureProfile = useCallback(async () => {
    if (!session?.user) return;
    // Idempotent: only inserts if a profile row doesn't already exist.
    const { error } = await withClockSkewRetry(async () =>
      supabase.from('profiles').upsert(
        {
          id: session.user.id,
          display_name: session.user.email?.split('@')[0] ?? 'Anonymous',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
    );
    if (error) console.error('Failed to ensure profile:', error.message);
  }, [session]);

  const partnerId =
    pair && session?.user
      ? pair.user_a === session.user.id
        ? pair.user_b
        : pair.user_a
      : null;

  const refreshProfiles = useCallback(async () => {
    if (!session?.user) return;
    const ids = [session.user.id, partnerId].filter(Boolean) as string[];
    const { data, error } = await supabase.from('profiles').select('*').in('id', ids);
    if (error) {
      console.error('Failed to load profiles:', error.message);
      return;
    }
    setMyProfile(data?.find((p) => p.id === session.user.id) ?? null);
    setPartnerProfile(data?.find((p) => p.id === partnerId) ?? null);
  }, [session, partnerId]);

  useEffect(() => {
    ensureProfile();
    refreshPair();
  }, [ensureProfile, refreshPair]);

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  const value = useMemo(
    () => ({
      session,
      pair,
      loading,
      refreshPair,
      myProfile,
      partnerProfile,
      refreshProfiles,
    }),
    [session, pair, loading, refreshPair, myProfile, partnerProfile, refreshProfiles]
  );

  return (
    <PairingContext.Provider value={value}>
      {children}
    </PairingContext.Provider>
  );
}

export function usePairing() {
  const ctx = useContext(PairingContext);
  if (!ctx) throw new Error('usePairing must be used within PairingProvider');
  return ctx;
}
