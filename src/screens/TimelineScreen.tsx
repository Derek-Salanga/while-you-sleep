import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { usePairing } from '@/lib/PairingContext';
import { useClips } from '@/hooks/queries';
import { usePartnerName } from '@/hooks/usePartnerName';
import { sharedTodayDateString, sharedYesterdayDateString } from '@/lib/date';
import { Clip } from '@/types';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import Screen from '@/components/ui/Screen';
import Card from '@/components/ui/Card';
import HeroCard from '@/components/HeroCard';
import StoryRings from '@/components/StoryRings';
import CrossoverHeart from '@/components/CrossoverHeart';

// Budget: the last staggered card must finish inside 300ms, so the stagger
// index is capped rather than letting delay grow with list length --
// (4 * 25) + 180 = 280ms no matter how many clips are in the timeline.
const ENTER_MS = 180;
const STAGGER_MS = 25;
const MAX_STAGGER_STEPS = 4;
// FadeInDown starts below its final position (translateY 25 by default) and
// rises into place; 12 keeps that to the "slight" end.
const ENTER_TRANSLATE_Y = 12;

// clips are stamped with the pair's shared (UTC) day — see
// sharedTodayDateString in src/lib/date.ts — so Today/Yesterday compare
// against that same boundary, not the device's local one. Both sides are
// plain YYYY-MM-DD strings, so a string compare is exact and needs no
// Date construction at all.
//
// The fallback still builds a Date from the literal components rather
// than `new Date(dateStr)` (which parses as UTC midnight and can display
// a day off west of UTC) — it's only rendering the stored calendar date.
function formatClipDate(dateStr: string): string {
  if (dateStr === sharedTodayDateString()) return 'Today';
  if (dateStr === sharedYesterdayDateString()) return 'Yesterday';

  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function TimelineScreen({ navigation }: any) {
  const { session, pair, myProfile } = usePairing();
  const partnerName = usePartnerName();
  // No useFocusEffect refetch anymore: the tab navigator unmounts this
  // screen on blur, so a tab switch remounts and refetches, and coming back
  // from ClipView refetches because marking a clip viewed invalidates
  // ['clips'].
  const { data: clips = [], isLoading, refetch, error } = useClips(pair?.id);

  // Driven by an explicit pull flag rather than react-query's isRefetching.
  // isRefetching is true for *any* refetch, including the one this screen
  // fires on every remount (see the note above), and RefreshControl responds
  // by expanding its ~60pt spinner area -- so simply opening the tab pushed
  // the whole list down until the refetch landed. It also claimed a pull had
  // happened when none had.
  const [pulling, setPulling] = useState(false);
  const onPullRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  function isMine(clip: Clip): boolean {
    return clip.sender_id === session?.user.id;
  }

  // Entrance motion is for the initial mount only. A ref rather than state
  // on purpose: flipping state here would re-render the whole list to
  // deliver a value that only ever needs to be read on the *next* render.
  // Without this guard the cards would also animate mid-scroll, since
  // FlatList mounts rows as they come into the viewport, and again on any
  // refetch that appends one.
  const entranceDone = useRef(false);
  useEffect(() => {
    const timer = setTimeout(
      () => {
        entranceDone.current = true;
      },
      MAX_STAGGER_STEPS * STAGGER_MS + ENTER_MS
    );
    return () => clearTimeout(timer);
  }, []);

  function renderItem({ item, index }: { item: Clip; index: number }) {
    const mine = isMine(item);
    const unwatched = !mine && !item.viewed_at;

    const entering = entranceDone.current
      ? undefined
      : FadeInDown.duration(ENTER_MS)
          .delay(Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS)
          .withInitialValues({
            transform: [{ translateY: ENTER_TRANSLATE_Y }],
          });

    return (
      <Animated.View entering={entering}>
        <Card
          onPress={() => navigation.navigate('ClipView', { clipId: item.id })}
          style={[styles.card, mine ? styles.cardMine : styles.cardPartner]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardSender}>
              {mine
                ? (myProfile?.display_name ?? 'You')
                : (partnerName ?? 'Your partner')}
            </Text>
            {unwatched && <View style={styles.unwatchedDot} />}
          </View>
          <Text style={styles.cardDate}>
            {formatClipDate(item.recorded_for_date)}
          </Text>
          {item.caption_text && (
            <Text style={styles.cardCaption}>{item.caption_text}</Text>
          )}
        </Card>
      </Animated.View>
    );
  }

  return (
    <Screen padding={20} topInset>
      <Text style={styles.title}>Timeline</Text>
      <HeroCard />
      <StoryRings navigation={navigation} />
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={clips}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={pulling} onRefresh={onPullRefresh} />
          }
          ListEmptyComponent={
            error ? (
              <Text style={styles.empty}>
                {"Couldn't load your clips. Pull down to try again."}
              </Text>
            ) : (
              <View style={styles.emptyState}>
                <CrossoverHeart size={88} />
                <Text style={styles.emptyHeadline}>Your story starts here</Text>
                <Text style={styles.emptyBody}>
                  Record your first clip. Your partner will find it waiting when
                  they wake up.
                </Text>
              </View>
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.ink,
    marginBottom: 16,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingBottom: 20 },
  card: {
    padding: 18,
    marginBottom: 12,
  },
  // Whose card it is has three signals, deliberately: the fill, a 4pt edge
  // in the full-strength colour, and which side it hangs off. The tints
  // these used to be filled with sat ~4% off `background`, so at a glance
  // the whole feed read as one column of white cards.
  //
  // The edge is what actually carries at a glance; the fill stays soft
  // rather than saturated so it doesn't compete with HeroCard, which sits
  // directly above the list already in full-strength primary/secondary.
  //
  // borderLeftWidth/Color override the 1pt border Card sets, since this
  // style is merged last (see ui/Card.tsx).
  cardMine: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    alignSelf: 'flex-end',
    width: '80%',
  },
  cardPartner: {
    backgroundColor: colors.secondarySoft,
    borderColor: colors.secondaryLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondaryDark,
    alignSelf: 'flex-start',
    width: '80%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSender: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.ink,
  },
  unwatchedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  cardDate: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginTop: 4,
  },
  // Not truncated: captions are short by design, and ClipViewScreen shows the
  // same text in full, so the two surfaces stay consistent.
  cardCaption: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.ink,
    lineHeight: 20,
    marginTop: 8,
  },
  empty: {
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 60,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 24,
  },
  emptyHeadline: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 20,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
