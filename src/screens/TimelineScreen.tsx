import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { Clip } from '@/types';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

export default function TimelineScreen({ navigation }: any) {
  const { session, pair } = usePairing();
  const insets = useSafeAreaInsets();
  const [clips, setClips] = useState<Clip[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadClips = useCallback(async () => {
    if (!pair) return;
    const { data, error } = await supabase
      .from('clips')
      .select('*')
      .eq('pair_id', pair.id)
      .order('recorded_for_date', { ascending: false });

    if (error) {
      console.error('Failed to load clips:', error.message);
      return;
    }
    setClips(data ?? []);
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
        style={[styles.card, mine ? styles.cardMine : styles.cardPartner]}
        onPress={() => navigation.navigate('ClipView', { clipId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardSender}>
            {mine ? 'You' : 'Your partner'}
          </Text>
          {unwatched && <View style={styles.unwatchedDot} />}
        </View>
        <Text style={styles.cardDate}>{item.recorded_for_date}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Timeline</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
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
            No clips yet. Record your first one to get started.
          </Text>
        }
      />
      <Pressable
        style={styles.recordFab}
        onPress={() => navigation.navigate('Record')}
      >
        <Text style={styles.recordFabText}>Record today's clip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.ink,
  },
  signOut: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  list: { paddingBottom: 100 },
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
  recordFab: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  recordFabText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.surface,
    fontSize: fontSizes.md,
  },
});
