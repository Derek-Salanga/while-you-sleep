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
import { useProfile } from '@/hooks/queries';
import { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  myProfile: Profile | null;
  refreshMyProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
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

  const { data: myProfile, refetch: refetchMyProfile } = useProfile(userId);

  // Idempotent: only inserts if a profile row doesn't already exist, so
  // firing it more than once for a session is harmless.
  const ensureProfile = useMutation({
    mutationFn: async (user: Session['user']) => {
      const { error } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          // Truncated to match the <= 20 char check constraint on
          // profiles.display_name (schema.sql) and SettingsScreen's
          // maxLength. An email prefix can easily exceed it --
          // `dereksalanga+partner2` is 21 -- and this default is
          // generated here, so it has to respect the limit itself
          // rather than hand the DB a value it will reject.
          display_name: (user.email?.split('@')[0] ?? 'Anonymous').slice(0, 20),
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

  const refreshMyProfile = useCallback(async () => {
    await refetchMyProfile();
  }, [refetchMyProfile]);

  const value = useMemo(
    () => ({
      session,
      loading,
      myProfile: myProfile ?? null,
      refreshMyProfile,
    }),
    [session, loading, myProfile, refreshMyProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
