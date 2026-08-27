import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Clip, Pair, Profile } from '@/types';

// Query keys are plain arrays, no key factory -- there are four of them.
// Every queryFn throws on a Supabase error so react-query owns the error
// state, rather than logging and returning a sentinel value.

export function usePair(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['pair', userId],
    enabled: !!userId,
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
