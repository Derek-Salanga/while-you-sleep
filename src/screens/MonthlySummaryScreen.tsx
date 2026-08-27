import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { formatDateString } from '@/lib/date';
import { Clip } from '@/types';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export default function MonthlySummaryScreen({ navigation }: any) {
  const { session, pair } = usePairing();
  const insets = useSafeAreaInsets();

  // The 1st of the month currently being viewed.
  const [refDate, setRefDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);

  const isCurrentMonth = isSameMonth(refDate, new Date());

  const loadMonth = useCallback(async () => {
    if (!pair) return;
    setLoading(true);
    const monthStart = formatDateString(
      new Date(refDate.getFullYear(), refDate.getMonth(), 1)
    );
    const monthEnd = formatDateString(
      new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)
    );
    const { data, error } = await supabase
      .from('clips')
      .select('*')
      .eq('pair_id', pair.id)
      .gte('recorded_for_date', monthStart)
      .lte('recorded_for_date', monthEnd)
      .order('recorded_for_date', { ascending: true });

    if (error) {
      console.error('Failed to load monthly clips:', error.message);
      setClips([]);
      setLoading(false);
      return;
    }
    setClips(data ?? []);
    setLoading(false);
  }, [pair, refDate]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  function isMine(clip: Clip): boolean {
    return clip.sender_id === session?.user.id;
  }

  const daysInMonth = new Date(
    refDate.getFullYear(),
    refDate.getMonth() + 1,
    0
  ).getDate();

  // day-of-month -> who posted that day, for the calendar grid and the
  // "both days" stat.
  const dayStatus = new Map<number, { mine: boolean; partner: boolean }>();
  for (const clip of clips) {
    const day = Number(clip.recorded_for_date.split('-')[2]);
    const entry = dayStatus.get(day) ?? { mine: false, partner: false };
    if (isMine(clip)) entry.mine = true;
    else entry.partner = true;
    dayStatus.set(day, entry);
  }

  const mineCount = clips.filter(isMine).length;
  const partnerCount = clips.length - mineCount;
  const bothDaysCount = Array.from(dayStatus.values()).filter(
    (d) => d.mine && d.partner
  ).length;

  // Chronological clip ids for the sequential reel — clips is already
  // ascending-ordered from the query.
  const queueIds = clips.map((c) => c.id);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 20 }]}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Monthly Summary</Text>

      <View style={styles.monthNav}>
        <Pressable
          style={({ pressed }) => [
            styles.monthNavButton,
            pressed && styles.pressed,
          ]}
          onPress={() =>
            setRefDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
          }
        >
          <Text style={styles.monthNavButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>
          {refDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.monthNavButton,
            pressed && styles.pressed,
            isCurrentMonth && styles.monthNavButtonDisabled,
          ]}
          onPress={() =>
            setRefDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
          }
          disabled={isCurrentMonth}
        >
          <Text style={styles.monthNavButtonText}>›</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{mineCount}</Text>
              <Text style={styles.statLabel}>You</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{partnerCount}</Text>
              <Text style={styles.statLabel}>Partner</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{bothDaysCount}</Text>
              <Text style={styles.statLabel}>Both days</Text>
            </View>
          </View>

          <View style={styles.grid}>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const status = dayStatus.get(day);
              return (
                <View key={day} style={styles.dayCell}>
                  <Text style={styles.dayNumber}>{day}</Text>
                  <View style={styles.dayDots}>
                    {status?.mine && (
                      <View style={[styles.dot, styles.dotMine]} />
                    )}
                    {status?.partner && (
                      <View style={[styles.dot, styles.dotPartner]} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.watchButton,
              queueIds.length === 0 && styles.watchButtonDisabled,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              navigation.navigate('ClipView', {
                clipId: queueIds[0],
                queue: queueIds,
              })
            }
            disabled={queueIds.length === 0}
          >
            <Text style={styles.watchButtonText}>
              {queueIds.length === 0
                ? 'No clips this month'
                : `Watch this month's clips (${queueIds.length})`}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.ink,
    marginBottom: 20,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  monthNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNavButtonDisabled: {
    opacity: 0.3,
  },
  monthNavButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.lg,
    color: colors.ink,
  },
  monthLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  centered: { paddingVertical: 60, alignItems: 'center' },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.ink,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumber: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.muted,
  },
  dayDots: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
    height: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotMine: {
    backgroundColor: colors.primary,
  },
  dotPartner: {
    backgroundColor: colors.secondary,
  },
  watchButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  watchButtonDisabled: {
    opacity: 0.5,
  },
  watchButtonText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.surface,
    fontSize: fontSizes.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
