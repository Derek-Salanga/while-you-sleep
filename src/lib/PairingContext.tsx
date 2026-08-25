import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Pair } from '@/types';

interface PairingContextValue {
  session: Session | null;
  pair: Pair | null;
  loading: boolean;
  refreshPair: () => Promise<void>;
}

const PairingContext = createContext<PairingContextValue | undefined>(
  undefined
);

// Supabase's Auth and PostgREST services occasionally drift out of clock
// sync by a second or two right after a fresh sign-in, which makes
// PostgREST reject a just-issued JWT as "issued at future" (PGRST303).
// It's a transient, server-side timing issue that clears itself within a
// couple of seconds, so retry once after a short delay instead of
// surfacing an error on the very first query after login.
async function withClockSkewRetry<T>(
  fn: () => PromiseLike<{ data: T; error: any }>
): Promise<{ data: T; error: any }> {
  const first = await fn();
  if (first.error && /issued at future/i.test(first.error.message ?? '')) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return fn();
  }
  return first;
}

export function PairingProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [pair, setPair] = useState<Pair | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshPair = async () => {
    if (!session?.user) {
      setPair(null);
      return;
    }
    const { data, error } = await withClockSkewRetry(() =>
      supabase
        .from('pairs')
        .select('*')
        .or(`user_a.eq.${session.user.id},user_b.eq.${session.user.id}`)
        .maybeSingle()
    );

    if (error) {
      console.error('Failed to load pair:', error.message);
      return;
    }
    setPair(data ?? null);
  };

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

  useEffect(() => {
    ensureProfile();
    refreshPair();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const ensureProfile = async () => {
    if (!session?.user) return;
    // Idempotent: only inserts if a profile row doesn't already exist.
    const { error } = await withClockSkewRetry(() =>
      supabase.from('profiles').upsert(
        {
          id: session.user.id,
          display_name: session.user.email?.split('@')[0] ?? 'Anonymous',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
    );
    if (error) console.error('Failed to ensure profile:', error.message);
  };

  const value = useMemo(
    () => ({ session, pair, loading, refreshPair }),
    [session, pair, loading]
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
