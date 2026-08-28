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
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export default function StoryRings({ navigation }: { navigation: any }) {
  const { session, pair, myProfile, partnerProfile } = usePairing();
  const { data: clips = [] } = useClips(pair?.id);

  const today = sharedTodayDateString();
  const myClipToday = clips.find(
    (c: Clip) => c.sender_id === session?.user.id && c.recorded_for_date === today,
  );
  const partnerClipToday = clips.find(
    (c: Clip) => c.sender_id !== session?.user.id && c.recorded_for_date === today,
  );

  function goToClip(clip: Clip | undefined) {
    if (!clip) return;
    navigation.navigate('ClipView', { clipId: clip.id });
  }

  const partnerUnwatched = !!partnerClipToday && !partnerClipToday.viewed_at;

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
        muted={!partnerClipToday || !partnerUnwatched}
        onPress={partnerClipToday ? () => goToClip(partnerClipToday) : undefined}
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
    width: RING_SIZE,
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
