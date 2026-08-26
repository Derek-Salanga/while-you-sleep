import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { Clip } from '@/types';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

export default function ClipViewScreen({ route, navigation }: any) {
  const { clipId } = route.params as { clipId: string };
  const { session } = usePairing();
  const insets = useSafeAreaInsets();
  const [clip, setClip] = useState<Clip | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const player = useVideoPlayer(videoUrl ?? '', (p) => {
    if (videoUrl) {
      p.play();
    }
  });

  useEffect(() => {
    loadClip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipId]);

  async function loadClip() {
    setLoading(true);
    try {
      const { data: clipData, error } = await supabase
        .from('clips')
        .select('*')
        .eq('id', clipId)
        .single();
      if (error) throw error;
      setClip(clipData);

      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('clips')
        .createSignedUrl(clipData.storage_path, 60 * 10);
      if (urlError) throw urlError;
      setVideoUrl(signedUrlData.signedUrl);

      const isRecipient = clipData.sender_id !== session?.user.id;
      if (isRecipient && !clipData.viewed_at) {
        await supabase
          .from('clips')
          .update({ viewed_at: new Date().toISOString() })
          .eq('id', clipId);
      }
    } catch (err: any) {
      console.error('Failed to load clip:', err.message);
    } finally {
      setLoading(false);
    }
  }

  const closeButton = (
    <Pressable
      style={({ pressed }) => [
        styles.closeButton,
        { top: insets.top + 12 },
        pressed && styles.pressed,
      ]}
      onPress={() => navigation.goBack()}
    >
      <Text style={styles.closeButtonText}>✕</Text>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
        {closeButton}
      </View>
    );
  }

  if (!clip || !videoUrl) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn't load this clip.</Text>
        {closeButton}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VideoView
        style={styles.video}
        player={player}
        allowsFullscreen
        nativeControls
        contentFit="contain"
      />
      {closeButton}
      <Text style={styles.dateLabel}>{clip.recorded_for_date}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  centered: {
    flex: 1,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: { flex: 1, width: '100%' },
  dateLabel: {
    fontFamily: fonts.body,
    color: colors.surface,
    textAlign: 'center',
    padding: 16,
  },
  errorText: {
    fontFamily: fonts.body,
    color: colors.surface,
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: colors.surface,
    fontSize: fontSizes.md,
    fontFamily: fonts.bodySemiBold,
  },
  pressed: {
    opacity: 0.7,
  },
});
