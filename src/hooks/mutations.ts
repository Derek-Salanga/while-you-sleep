import { useMutation, useQueryClient } from '@tanstack/react-query';
// expo-file-system's default export moved to a new File/Directory-based
// API in the SDK 54 version bump; the legacy import keeps getInfoAsync /
// readAsStringAsync working without a full rewrite.
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { supabase } from '@/lib/supabase';
import { Clip } from '@/types';

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
