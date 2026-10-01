import { useMutation, useQueryClient } from '@tanstack/react-query';
// expo-file-system's default export moved to a new File/Directory-based
// API in the SDK 54 version bump; the legacy import keeps getInfoAsync /
// readAsStringAsync working without a full rewrite.
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { supabase } from '@/lib/supabase';
import { Clip, Profile } from '@/types';

interface UploadClipInput {
  pairId: string;
  senderId: string;
  uri: string;
  date: string; // shared (UTC) day -- see sharedTodayDateString in src/lib/date.ts
  caption: string;
}

export function useUploadClip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pairId,
      senderId,
      uri,
      date,
      caption,
    }: UploadClipInput): Promise<Clip> => {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('Recorded file not found.');

      // No extension in the path, on purpose. It used to end in the
      // recorded file's own extension -- .mov on iOS, .mp4 on Android --
      // so re-recording the same day from the other platform wrote to a
      // *different* path, leaving the previous file orphaned in Storage
      // with its clips row still pointing at the new one. A constant path
      // means the upsert below always overwrites in place.
      const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'mov';
      const storagePath = `${pairId}/${senderId}/${date}`;
      // With no extension in the URL, the player has only Content-Type to
      // go on, so it has to be a real MIME type -- `video/mov` (what this
      // sent before) isn't one.
      const contentType = fileExt === 'mov' ? 'video/quicktime' : 'video/mp4';

      const fileData = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { error: uploadError } = await supabase.storage
        .from('clips')
        .upload(storagePath, Buffer.from(fileData, 'base64'), {
          contentType,
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data, error: insertError } = await supabase
        .from('clips')
        .upsert(
          {
            pair_id: pairId,
            sender_id: senderId,
            storage_path: storagePath,
            recorded_for_date: date,
            caption_text: caption.trim() || null,
          },
          { onConflict: 'pair_id,sender_id,recorded_for_date' }
        )
        .select()
        .single();
      if (insertError) throw insertError;

      return data as Clip;
    },
    // Timeline picks the new clip up on its own instead of waiting for a
    // focus event or a pull-to-refresh.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clips'] }),
  });
}

// Retry a clip whose AI processing failed. RPC rather than a table write,
// mirroring mark_clip_viewed() -- the security definer function is what
// enforces "only your own clip, only if it's actually failed" server-side.
export function useRetryAiProcessing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clipId: string) => {
      const { error } = await supabase.rpc('retry_ai_processing', {
        target_clip_id: clipId,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clips'] }),
  });
}

// Clearing the Timeline's unwatched dot is the whole point of invalidating
// here -- the row itself is written and forgotten.
export function useMarkClipViewed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clipId: string) => {
      const { error } = await supabase.rpc('mark_clip_viewed', {
        target_clip_id: clipId,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clips'] }),
  });
}

// Deletes the caller's auth.users row via the delete_own_account() RPC,
// which cascades their profile, their pair, and every clip / trip /
// anniversary hanging off that pair -- the partner's included. See the
// comment on that function in schema.sql.
//
// signOut is scoped to 'local' deliberately: the default revokes the
// session server-side, but by then the user it belongs to no longer
// exists, so that call fails and would leave the app holding a session for
// a deleted account. Clearing locally is all that's needed -- the JWT is
// unusable regardless, since every RLS policy resolves through auth.uid().
//
// The cache is cleared after, not before: dropping it while the session is
// still live would let queries refetch against an account that's already
// gone.
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('delete_own_account');
      if (error) throw error;
      await supabase.auth.signOut({ scope: 'local' });
      queryClient.clear();
    },
  });
}

interface SetReactionInput {
  clipId: string;
  userId: string;
  // null removes the reaction -- that's what tapping your current one again
  // does. There's no separate "clear" affordance, same as blank-on-save
  // deletes a partner nickname.
  emoji: string | null;
}

export function useSetReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clipId, userId, emoji }: SetReactionInput) => {
      if (emoji === null) {
        const { error } = await supabase
          .from('clip_reactions')
          .delete()
          .eq('clip_id', clipId)
          .eq('user_id', userId);
        if (error) throw error;
        return;
      }
      // Upsert on the primary key: one reaction per person per clip, so
      // changing your mind replaces rather than accumulating.
      const { error } = await supabase
        .from('clip_reactions')
        .upsert(
          { clip_id: clipId, user_id: userId, emoji },
          { onConflict: 'clip_id,user_id' }
        );
      if (error) throw error;
    },
    // Invalidate rather than setQueryData: a delete returns no row to write
    // back, so both paths would need different handling otherwise.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reactions'] });
    },
  });
}

// Favorite/un-favorite a clip. Binary, unlike useSetReaction's emoji value:
// favoriting is an insert, un-favoriting (tapping the star again) is a
// delete -- there's no "change your mind" case that needs an update.
export function useSetFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clipId,
      userId,
      favorited,
    }: {
      clipId: string;
      userId: string;
      favorited: boolean;
    }) => {
      if (favorited) {
        const { error } = await supabase
          .from('clip_favorites')
          .insert({ clip_id: clipId, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clip_favorites')
          .delete()
          .eq('clip_id', clipId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
}

// AI summary opt-in: a plain update on your own row, same pattern as the
// nickname edit -- profiles_update_own already covers it, no RPC needed.
// Optimistic: a Switch is bound directly to server state here (no local
// staging step like the nickname/anniversary edit cards), so without this
// it visibly lags a full round trip -- update, then the invalidate's
// refetch -- before flipping.
export function useSetAiEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      enabled,
    }: {
      userId: string;
      enabled: boolean;
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ ai_enabled: enabled })
        .eq('id', userId);
      if (error) throw error;
    },
    onMutate: async ({ userId, enabled }) => {
      const key = ['profile', userId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Profile>(key);
      if (previous) {
        queryClient.setQueryData<Profile>(key, {
          ...previous,
          ai_enabled: enabled,
        });
      }
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: (_data, _err, { userId }) =>
      queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
  });
}

// Reports a clip for the developer to review (App Store guideline 1.2). RPC
// rather than a table insert -- clip_reports has no client insert policy,
// and report_clip() is what snapshots the caption/storage path before a
// block can cascade the clips row away. No explicit `retry` override: v5
// already defaults mutations to 0 (see "Known transient error" in
// CLAUDE.md), which is what we want here -- a retried report after a
// transient failure would just duplicate it.
export function useReportClip() {
  return useMutation({
    mutationFn: async ({
      clipId,
      reason,
    }: {
      clipId: string;
      reason: 'inappropriate' | 'harassment' | 'other';
    }) => {
      const { error } = await supabase.rpc('report_clip', {
        target_clip_id: clipId,
        reason,
      });
      if (error) throw error;
    },
  });
}

// Ends the pairing and blocks the partner so they can never pair with you
// again (see join_pair_by_code's guard in schema.sql). Invalidates ['pair']
// -- which RootNavigator's isPaired gate reads -- so the app re-routes to
// PairingScreen on its own, the same mechanism usePair's refetch already
// drives; ['clips'] too, since the shared history is gone along with the
// pairing. No explicit `retry` override, same reasoning as useReportClip:
// block_partner() deletes the pairs row, so a retried call after a
// transient failure would just raise "Not paired" against a pairing that
// no longer exists.
export function useBlockPartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('block_partner');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pair'] });
      queryClient.invalidateQueries({ queryKey: ['clips'] });
    },
  });
}

// Pause the pet: "we're travelling", not "we gave up". Either partner can
// set it, since it's shared state like pair_trips.
//
// An RPC rather than a table write because pair_pet has no update policy --
// and RLS can't express "you may change paused_until but not score", which
// is exactly the hole an update policy would open. Same reason
// mark_clip_viewed() exists.
export function useSetPetPause() {
  const queryClient = useQueryClient();
  return useMutation({
    // null resumes. There is no separate resume endpoint -- clearing the
    // date IS resuming, the same shape as blank-on-save clearing a nickname.
    mutationFn: async (until: string | null) => {
      const { error } = await supabase.rpc('set_pet_pause', { until });
      if (error) throw error;
    },
    // Invalidate rather than write back: the reminder's copy is derived from
    // this in RootNavigator, so it has to re-run rather than just repaint.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pet'] });
    },
  });
}
