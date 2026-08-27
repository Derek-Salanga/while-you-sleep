import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePairing } from '@/lib/PairingContext';
import { useClips } from '@/hooks/queries';
import { sharedTodayDateString, sharedYesterdayDateString } from '@/lib/date';
import { Clip } from '@/types';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

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
  const { session, pair, myProfile, partnerProfile } = usePairing();
  const insets = useSafeAreaInsets();
  // No useFocusEffect refetch anymore: the tab navigator unmounts this
  // screen on blur, so a tab switch remounts and refetches, and coming back
  // from ClipView refetches because marking a clip viewed invalidates
  // ['clips'].
  const {
    data: clips = [],
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useClips(pair?.id);

  function isMine(clip: Clip): boolean {
    return clip.sender_id === session?.user.id;
  }

  function renderItem({ item }: { item: Clip }) {
    const mine = isMine(item);
    const unwatched = !mine && !item.viewed_at;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          mine ? styles.cardMine : styles.cardPartner,
          pressed && styles.pressed,
        ]}
        onPress={() => navigation.navigate('ClipView', { clipId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardSender}>
            {mine
              ? (myProfile?.display_name ?? 'You')
              : (partnerProfile?.display_name ?? 'Your partner')}
          </Text>
          {unwatched && <View style={styles.unwatchedDot} />}
        </View>
        <Text style={styles.cardDate}>
          {formatClipDate(item.recorded_for_date)}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>Timeline</Text>
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
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {error
                ? "Couldn't load your clips. Pull down to try again."
                : 'No clips yet. Record your first one to get started.'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.ink,
    marginBottom: 16,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingBottom: 20 },
  card: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardMine: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primaryLight,
    alignSelf: 'flex-end',
    width: '80%',
  },
  cardPartner: {
    backgroundColor: colors.secondaryTint,
    borderColor: colors.secondaryLight,
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
  empty: {
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 60,
  },
  pressed: {
    opacity: 0.7,
  },
});
