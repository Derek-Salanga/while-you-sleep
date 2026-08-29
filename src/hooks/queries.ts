import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Clip, Pair, PairAnniversary, PairTrip, Profile } from '@/types';

// Query keys are plain arrays, no key factory -- there are six of them.
// Every queryFn throws on a Supabase error so react-query owns the error
// state, rather than logging and returning a sentinel value.

export function usePair(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['pair', userId],
    enabled: !!userId,
    // Polls only while an invite is outstanding -- a pairs row exists with
    // user_b still null. Without this, the partner who created the invite
    // sits on PairingScreen indefinitely: its useFocusEffect refetch never
    // fires again, because Pairing is the only mounted screen at that point
    // and so never blurs and re-focuses.
    //
    // Polling rather than realtime deliberately. This covers a window that
    // happens once per account, and realtime would mean the app's only
    // websocket plus a publication change on the live project. RecordScreen
    // already set this precedent with its 15s partner-reveal poll.
    //
    // Turns itself off the moment user_b lands, so a completed pair is never
    // polled: RootNavigator swaps Pairing -> MainTabs off the same value.
    refetchInterval: (query) =>
      query.state.data && !query.state.data.user_b ? 5000 : false,
    queryFn: async (): Promise<Pair | null> => {
      const { data, error } = await supabase
        .from('pairs')
        .select('*')
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useClips(pairId: string | null | undefined) {
  return useQuery({
    queryKey: ['clips', pairId],
    enabled: !!pairId,
    queryFn: async (): Promise<Clip[]> => {
      const { data, error } = await supabase
        .from('clips')
        .select('*')
        .eq('pair_id', pairId!)
        .order('recorded_for_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Deliberately bundles the signed playback URL with the row: ClipViewScreen
// can never use one without the other, so splitting them would just mean two
// loading states to reconcile. The URL is good for 10 minutes, comfortably
// longer than a 30s clip.
export function useClip(clipId: string) {
  return useQuery({
    queryKey: ['clip', clipId],
    queryFn: async (): Promise<{ clip: Clip; videoUrl: string }> => {
      const { data: clip, error } = await supabase
        .from('clips')
        .select('*')
        .eq('id', clipId)
        .single();
      if (error) throw error;

      const { data: signed, error: urlError } = await supabase.storage
        .from('clips')
        .createSignedUrl(clip.storage_path, 60 * 10);
      if (urlError) throw urlError;

      return { clip: clip as Clip, videoUrl: signed.signedUrl };
    },
  });
}

// Both of these are singleton rows keyed on pair_id, so maybeSingle() and a
// null result are the normal "not set yet" case, not an error.
//
// HomeScreen still fetches the same two tables inline with its own state --
// it owns the edit forms, and migrating those is a separate job. These exist
// for read-only consumers like HeroCard.
export function usePairTrip(pairId: string | null | undefined) {
  return useQuery({
    queryKey: ['pairTrip', pairId],
    enabled: !!pairId,
    queryFn: async (): Promise<PairTrip | null> => {
      const { data, error } = await supabase
        .from('pair_trips')
        .select('*')
        .eq('pair_id', pairId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePairAnniversary(pairId: string | null | undefined) {
  return useQuery({
    queryKey: ['pairAnniversary', pairId],
    enabled: !!pairId,
    queryFn: async (): Promise<PairAnniversary | null> => {
      const { data, error } = await supabase
        .from('pair_anniversary')
        .select('*')
        .eq('pair_id', pairId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
