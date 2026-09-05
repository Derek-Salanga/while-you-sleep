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
import { usePairing } from '@/lib/PairingContext';
import { useClip, useReactions } from '@/hooks/queries';
import { useMarkClipViewed, useSetReaction } from '@/hooks/mutations';
import { REACTION_EMOJI } from '@/data/reactions';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

export default function ClipViewScreen({ route, navigation }: any) {
  const { clipId, queue } = route.params as {
    clipId: string;
    queue?: string[];
  };
  const { session, pair } = usePairing();
  const insets = useSafeAreaInsets();
  const [queueIndex, setQueueIndex] = useState(0);

  const activeClipId = queue ? queue[queueIndex] : clipId;
  const isQueueFinished = !!queue && queueIndex >= queue.length;

  // useClip returns the row and its signed playback URL together -- one
  // loading state, since neither is usable without the other.
  const { data, isLoading } = useClip(activeClipId);
  const clip = data?.clip ?? null;
  const videoUrl = data?.videoUrl ?? null;

  const player = useVideoPlayer(videoUrl ?? '', (p) => {
    if (!videoUrl) return;
    p.play();
    // Sequential reel mode (Monthly Summary): auto-advance when a clip
    // finishes instead of leaving the viewer on a frozen last frame.
    if (queue) {
      p.addListener('playToEnd', () => setQueueIndex((i) => i + 1));
    }
  });

  useEffect(() => {
    if (isQueueFinished) navigation.goBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQueueFinished]);

  // Invalidates ['clips'] on success, which is what clears the Timeline's
  // unwatched dot. Can't loop: that key doesn't match this screen's
  // ['clip', id] query, so `clip` here never changes underneath us.
  const { mutate: markViewed } = useMarkClipViewed();
  useEffect(() => {
    if (!clip || !session?.user) return;
    const isRecipient = clip.sender_id !== session.user.id;
    if (isRecipient && !clip.viewed_at) markViewed(clip.id);
  }, [clip, session, markViewed]);

  // Reactions for the clip currently on screen. In reel mode this follows
  // activeClipId, so the row changes per clip along with the caption.
  const { data: reactions } = useReactions(pair?.id);
  const { mutate: setReaction } = useSetReaction();
  const myReaction =
    reactions?.find(
      (r) => r.clip_id === activeClipId && r.user_id === session?.user.id
    ) ?? null;
  const theirReaction =
    reactions?.find(
      (r) => r.clip_id === activeClipId && r.user_id !== session?.user.id
    ) ?? null;

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

  if (isLoading) {
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
      <View style={styles.reactionRow}>
        {/* Their reaction sits to the left, unpressable -- it's information,
            not a control. Absent entirely rather than a placeholder, so the
            row doesn't imply a reply that hasn't happened. */}
        {theirReaction && (
          <Text style={styles.theirReaction}>{theirReaction.emoji}</Text>
        )}
        {REACTION_EMOJI.map((emoji) => {
          const selected = myReaction?.emoji === emoji;
          return (
            <Pressable
              key={emoji}
              // Tapping your current reaction clears it; there's no separate
              // remove affordance, mirroring blank-on-save for nicknames.
              onPress={() =>
                session?.user &&
                setReaction({
                  clipId: activeClipId,
                  userId: session.user.id,
                  emoji: selected ? null : emoji,
                })
              }
              style={({ pressed }) => [
                styles.reactionButton,
                selected && styles.reactionButtonSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </Pressable>
          );
        })}
      </View>
      {clip.caption_text && (
        <Text style={styles.caption}>{clip.caption_text}</Text>
      )}
      <Text style={styles.dateLabel}>
        {clip.recorded_for_date}
        {queue ? `  ·  ${queueIndex + 1} of ${queue.length}` : ''}
      </Text>
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
  // Above the date rather than below it: the caption is the clip's content,
  // the date is metadata. The video is flex: 1, so a long one shrinks the
  // player rather than getting clipped.
  caption: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.surface,
    textAlign: 'center',
    lineHeight: 22,
    paddingTop: 16,
    paddingHorizontal: 24,
  },
  // Between the video and the caption: close enough to the clip to read as
  // a response to it, above the caption because the caption is the clip's
  // own content and this is the reply to it.
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  reactionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
  },
  reactionButtonSelected: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  reactionEmoji: { fontSize: 22 },
  theirReaction: {
    fontSize: 22,
    opacity: 0.85,
    marginRight: 8,
  },
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
