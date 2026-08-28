import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { usePairing } from '@/lib/PairingContext';
import { useClips } from '@/hooks/queries';
import { sharedTodayDateString } from '@/lib/date';
import { Clip } from '@/types';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

const RING_SIZE = 64;
const RING_STROKE = 3;
const AVATAR_SIZE = RING_SIZE - RING_STROKE * 2 - 6; // leaves a gap between ring and avatar
const RADIUS = (RING_SIZE - RING_STROKE) / 2;
const LABEL_WIDTH = 84;
const MUTED_GRAY = '#B8B2C4';

function initial(name: string | null | undefined, fallback: string): string {
  return (name?.trim()?.[0] ?? fallback).toUpperCase();
}

// A gradient ring around an initial-in-a-circle avatar -- no avatar photo
// field exists on `profiles`, so this falls back to an initial like most
// apps do before a real photo is wired up.
function Ring({
  label,
  initialLetter,
  gradientId,
  gradientFrom,
  gradientTo,
  muted,
  onPress,
}: {
  label: string;
  initialLetter: string;
  gradientId: string;
  gradientFrom: string;
  gradientTo: string;
  muted: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.ringContainer}
      onPress={onPress}
      disabled={!onPress}
    >
      {/* The ring and avatar live in their own RING_SIZE box so the avatar's
          absolute offsets stay relative to the ring, not to the wider
          container that gives the label room to breathe. */}
      <View style={styles.ringBox}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={gradientFrom} />
              <Stop offset="1" stopColor={gradientTo} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={muted ? MUTED_GRAY : `url(#${gradientId})`}
            strokeWidth={RING_STROKE}
            fill="none"
          />
        </Svg>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{initialLetter}</Text>
        </View>
      </View>
      {/* Display names run to 20 chars, so without this a name like
          "dereksalanga+part1" wrapped mid-word across two lines. */}
      <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </Pressable>
  );
}

export default function StoryRings({ navigation }: { navigation: any }) {
  const { session, pair, myProfile, partnerProfile } = usePairing();
  const { data: clips = [] } = useClips(pair?.id);

  const today = sharedTodayDateString();

  // The two rings deliberately answer different questions, so only one of
  // them is scoped to today:
  //   yours    -- "have I posted today?", the same prompt the Home CTA's dot
  //               gives, and meaningless for any earlier day.
  //   partner  -- "is there anything here I haven't watched?", which has to
  //               look past today or it contradicts the Timeline: a clip
  //               from yesterday you haven't opened would show a grey
  //               (watched-looking) ring directly above a card wearing a red
  //               unwatched dot.
  const myClipToday = clips.find(
    (c: Clip) =>
      c.sender_id === session?.user.id && c.recorded_for_date === today
  );

  // useClips returns newest-first, so find() yields the most recent match.
  const partnerClips = clips.filter(
    (c: Clip) => c.sender_id !== session?.user.id
  );
  const partnerUnwatched = partnerClips.find((c: Clip) => !c.viewed_at);
  // Fall back to the newest clip so the ring stays tappable once everything
  // has been watched -- it just isn't highlighted any more.
  const partnerTarget = partnerUnwatched ?? partnerClips[0];

  function goToClip(clip: Clip | undefined) {
    if (!clip) return;
    navigation.navigate('ClipView', { clipId: clip.id });
  }

  return (
    <View style={styles.row}>
      <Ring
        label="You"
        initialLetter={initial(myProfile?.display_name, 'Y')}
        gradientId="ringYou"
        gradientFrom={colors.primary}
        gradientTo={colors.primaryLight}
        muted={!myClipToday}
        onPress={myClipToday ? () => goToClip(myClipToday) : undefined}
      />
      <Ring
        label={partnerProfile?.display_name ?? 'Partner'}
        initialLetter={initial(partnerProfile?.display_name, 'P')}
        gradientId="ringPartner"
        gradientFrom={colors.secondary}
        gradientTo={colors.secondaryLight}
        muted={!partnerUnwatched}
        onPress={partnerTarget ? () => goToClip(partnerTarget) : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 20,
  },
  ringContainer: {
    alignItems: 'center',
    // Wider than the ring itself so a name gets a usable amount of room
    // before it ellipsizes; the ring stays centred within it.
    width: LABEL_WIDTH,
  },
  ringBox: {
    width: RING_SIZE,
    height: RING_SIZE,
  },
  avatar: {
    position: 'absolute',
    top: (RING_SIZE - AVATAR_SIZE) / 2,
    left: (RING_SIZE - AVATAR_SIZE) / 2,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.display,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginTop: 4,
  },
});
