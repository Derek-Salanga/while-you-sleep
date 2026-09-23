import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { usePairing } from '@/lib/PairingContext';
import { usePartnerName } from '@/hooks/usePartnerName';
import {
  useClips,
  usePairTrip,
  usePairAnniversary,
  usePetState,
} from '@/hooks/queries';
import SharedPet from '@/components/SharedPet';
import HeroCard, { isTripUpcoming } from '@/components/HeroCard';
import { petMood, PetMood } from '@/types';
import {
  todayDateString,
  sharedTodayDateString,
  daysBetween,
} from '@/lib/date';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';

// What the pet card says. Every line is phrased as a state of the pair, not
// an instruction to the reader -- "it's been quiet" rather than "you haven't
// posted". A shared pet that nags is just a streak counter with a face, and
// the guilt dynamic is the thing this feature exists to avoid.
const PET_COPY: Record<PetMood, { title: string; body: string }> = {
  thriving: { title: 'Thriving', body: "You've both been showing up." },
  content: { title: 'Doing well', body: 'Keep it going.' },
  sleepy: {
    title: 'Getting sleepy',
    body: "It's been a quiet couple of days.",
  },
  withdrawn: {
    title: 'Waiting for you both',
    body: 'A day from each of you brings it back.',
  },
};

export default function HomeScreen({ navigation }: any) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { session, pair } = usePairing();
  const partnerName = usePartnerName();
  const insets = useSafeAreaInsets();
  // These used to be useState + useFocusEffect fetches. Because
  // unmountOnBlur remounts this screen on every tab visit, that state reset
  // to its falsy default each time and the screen rendered "Plan your next
  // visit" and a hidden anniversary line as though they were loaded data --
  // a flash of *wrong* content, not of blank space. Reading the react-query
  // cache instead means a remount renders the previous value immediately and
  // refetches behind it, so the flash only exists on a cold start.
  const { data: trip } = usePairTrip(pair?.id);
  const { data: anniversary } = usePairAnniversary(pair?.id);
  // Derived from the clips list rather than its own query: TimelineScreen
  // already populates ['clips', pairId], so arriving from that tab costs no
  // request at all. `undefined` while loading is load-bearing -- see the dot
  // below.
  const { data: clips } = useClips(pair?.id);
  const answeredToday =
    clips === undefined
      ? undefined
      : clips.some(
          (c) =>
            c.sender_id === session?.user.id &&
            c.recorded_for_date === sharedTodayDateString()
        );
  const tripUpcoming = isTripUpcoming(trip);

  const { data: pet } = usePetState(pair?.id);
  // Paused is a status laid over the current mood, not a mood of its own --
  // "we're travelling" must not read as a worse state of wellbeing.
  const petResting =
    !!pet?.paused_until && pet.paused_until >= sharedTodayDateString();
  const mood = pet ? petMood(pet.score) : null;

  const recordCtaScale = useSharedValue(1);
  const recordCtaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordCtaScale.value }],
  }));
  const handleRecordCtaPressIn = () => {
    recordCtaScale.value = withTiming(0.96, { duration: 100 });
  };
  const handleRecordCtaPressOut = () => {
    recordCtaScale.value = withTiming(1, { duration: 100 });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>Home</Text>
      {anniversary && (
        <Text style={styles.anniversaryText}>
          {daysBetween(anniversary.anniversary_date, todayDateString())} days
          together
          {partnerName ? ` with ${partnerName}` : ''}
        </Text>
      )}
      {/* An upcoming trip shows as the Timeline's HeroCard (same component,
          so the two can't drift). No trip, or one already past, shows the
          plain prompt -- HeroCard would fall back to the anniversary there,
          which Home already states in the line above. */}
      <Pressable
        style={({ pressed }) => pressed && styles.pressed}
        onPress={() => navigation.navigate('TripEdit')}
        accessibilityRole="button"
        accessibilityHint="Edits your next trip"
      >
        {trip === undefined ? (
          <View style={styles.tripPlaceholder} />
        ) : tripUpcoming ? (
          <HeroCard />
        ) : (
          <View style={styles.entryCard}>
            <Text style={styles.entryCardLabel}>Plan your next visit</Text>
          </View>
        )}
      </Pressable>
      {/* Above the record CTA on purpose: the pet's state is the reason to
          tap it, so it should be read first. */}
      {mood && (
        <View style={styles.petCard}>
          <SharedPet mood={mood} size={72} resting={petResting} />
          <View style={styles.petCopy}>
            <Text style={styles.petTitle}>
              {petResting ? 'Resting' : PET_COPY[mood].title}
            </Text>
            <Text style={styles.petBody}>
              {petResting ? "Paused while you're away." : PET_COPY[mood].body}
            </Text>
          </View>
        </View>
      )}
      {/* The daily clip IS the daily question's answer now -- RecordScreen
          shows the question, records the (video) answer, and reveals both
          partners' answers once submitted. See "Video daily question" in
          CLAUDE.md; replaces the old separate text-answer + generic-clip
          entry points. */}
      <Pressable
        style={styles.recordCtaPinned}
        onPress={() => navigation.navigate('Record')}
        onPressIn={handleRecordCtaPressIn}
        onPressOut={handleRecordCtaPressOut}
      >
        <Animated.View style={[styles.recordCta, recordCtaAnimatedStyle]}>
          <Text style={styles.recordCtaLabel}>Today's question</Text>
          {answeredToday === false && <View style={styles.unwatchedDot} />}
        </Animated.View>
      </Pressable>
    </View>
  );
}

// makeStyles rather than a module-level StyleSheet.create: the object
// has to be rebuilt when the theme changes.
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
      padding: 20,
      // The pinned CTA sets its own gap to the tab bar.
      paddingBottom: 0,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: t.textPrimary,
      marginBottom: 8,
    },
    anniversaryText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textMuted,
      marginBottom: 16,
    },
    petCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
    },
    petCopy: { flex: 1 },
    petTitle: {
      fontFamily: fonts.display,
      fontSize: fontSizes.md,
      color: t.textPrimary,
    },
    petBody: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textMuted,
      marginTop: 2,
    },
    entryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 14,
      paddingHorizontal: 18,
      marginBottom: 16,
    },
    entryCardLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.textPrimary,
    },
    recordCta: {
      // Solid, not a gradient. The gradient ran to the day-orange, which
      // dissolves into the light ground (1.44:1) so the button lost its edge --
      // and could not carry white. A solid `accent` also flips with the theme,
      // so the thing you're meant to tap always stands off the page: deep blue
      // on the day-lit theme, day-orange on the night one.
      backgroundColor: t.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 18,
      overflow: 'hidden',
    },
    // Pinned above the tab bar, 18pt clear of it like Monthly Summary's
    // action row.
    recordCtaPinned: {
      marginTop: 'auto',
      marginBottom: 18,
    },
    // HeroCard's footprint (120 + its 20 margin), held while the trip query
    // is still loading so the pet card doesn't jump when it resolves.
    tripPlaceholder: {
      height: 140,
    },
    recordCtaLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.textOnAccent,
    },
    // White, not t.danger: this dot sits on the record CTA's blue-to-orange
    // gradient, and salmon on the amber end was effectively invisible, so the
    // "you haven't answered today" signal was lost. White reads against both
    // ends. (TimelineScreen's same-named dot is on a pale card and stays red.)
    unwatchedDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.surface,
    },
    pressed: {
      opacity: 0.7,
    },
  });
