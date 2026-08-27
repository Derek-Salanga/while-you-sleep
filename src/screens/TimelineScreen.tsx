import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { Clip } from '@/types';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

// clips are stored as a plain YYYY-MM-DD string (see todayDateString in
// RecordScreen) — parse the components directly rather than through
// `new Date(dateStr)`, which treats it as UTC midnight and can shift a
// day off in negative-UTC-offset timezones.
function formatClipDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TimelineScreen({ navigation }: any) {
  const { session, pair } = usePairing();
  const insets = useSafeAreaInsets();
  const [clips, setClips] = useState<Clip[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadClips = useCallback(async () => {
    if (!pair) return;
    const { data, error } = await supabase
      .from('clips')
      .select('*')
      .eq('pair_id', pair.id)
      .order('recorded_for_date', { ascending: false });

    if (error) {
      console.error('Failed to load clips:', error.message);
      setLoadError("Couldn't load your clips. Pull down to try again.");
      setInitialLoading(false);
      return;
    }
    setLoadError(null);
    setClips(data ?? []);
    setInitialLoading(false);
  }, [pair]);

  useFocusEffect(
    useCallback(() => {
      loadClips();
    }, [loadClips])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadClips();
    setRefreshing(false);
  }

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
          <Text style={styles.cardSender}>{mine ? 'You' : 'Your partner'}</Text>
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
      {initialLoading ? (
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
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {loadError ??
                'No clips yet. Record your first one to get started.'}
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
