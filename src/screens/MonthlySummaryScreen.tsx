import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import NavIcon from '@/components/NavIcon';
import { usePairing } from '@/lib/PairingContext';
import { useClips, useFavorites } from '@/hooks/queries';
import { formatDateString } from '@/lib/date';
import { Clip } from '@/types';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';

// The month arrows. SVG rather than the ‹ › glyphs, which sit on the font's
// baseline and so render low and off-centre inside the 40pt circle.
function Chevron({
  direction,
  color,
}: {
  direction: 'left' | 'right';
  color: string;
}) {
  return (
    <Svg width={16} height={16} viewBox="0 0 100 100">
      <Path
        d={
          direction === 'left' ? 'M64 14 L28 50 L64 86' : 'M36 14 L72 50 L36 86'
        }
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export default function MonthlySummaryScreen({ navigation }: any) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { session, pair } = usePairing();
  const insets = useSafeAreaInsets();

  // The 1st of the month currently being viewed.
  const [refDate, setRefDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const isCurrentMonth = isSameMonth(refDate, new Date());
  // Nothing to show before the pair existed. pairs.created_at is when the
  // invite was made, not when the partner joined -- there's no joined-at
  // column -- but both nearly always land in the same month, and at worst
  // this allows one empty month rather than hiding a real one.
  const isFirstMonth = pair ? refDate <= new Date(pair.created_at) : true;
  const monthLabel = refDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Every clip for the pair, from the same cached query the Timeline uses,
  // filtered to the viewed month here. Switching months is then a filter,
  // not a fetch: no loading gap, nothing flashing from 0 to its real value.
  // (It used to fetch per month, and each change blanked the screen first.)
  const { data: allClips } = useClips(pair?.id);
  const monthPrefix = formatDateString(refDate).slice(0, 7);
  const clips = useMemo(
    () =>
      (allClips ?? [])
        .filter((c) => c.recorded_for_date.startsWith(monthPrefix))
        .reverse(),
    [allClips, monthPrefix]
  );

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

  // Counts for the two list buttons; the lists themselves live on
  // MonthListScreen so this screen fits without scrolling.
  const captioned = clips.filter((c) => c.caption_text);

  // Favorites come from the shared query (also used by ClipViewScreen)
  // rather than this screen's own inline style -- clip_favorites_select_
  // visible_clips already does the reveal-gating work, so filtering this
  // screen's already-visible `clips` array against it needs no extra fetch
  // logic of its own.
  const { data: favorites } = useFavorites(pair?.id);
  const favorited = clips.filter((c) =>
    favorites?.some((f) => f.clip_id === c.id)
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>Monthly Summary</Text>

      {/* Month nav, stats and calendar sit centred in whatever height is
          left between the title and the pinned action row. */}
      <View style={styles.middle}>
        <View style={styles.monthNav}>
          <Pressable
            style={({ pressed }) => [
              styles.monthNavButton,
              pressed && styles.pressed,
              isFirstMonth && styles.monthNavButtonDisabled,
            ]}
            onPress={() =>
              setRefDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
            }
            disabled={isFirstMonth}
          >
            <Chevron direction="left" color={t.textPrimary} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
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
            <Chevron direction="right" color={t.textPrimary} />
          </Pressable>
        </View>

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

        {/* A real calendar: Sunday-first weekday header, and the 1st
              offset to its actual weekday by blank cells. */}
        <View style={styles.grid}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <Text key={i} style={[styles.dayCell, styles.weekday]}>
              {d}
            </Text>
          ))}
          {Array.from({ length: refDate.getDay() }, (_, i) => (
            <View key={`blank-${i}`} style={styles.dayCell} />
          ))}
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
          {/* Always six week rows (42 cells), so a five-week month is
                  the same height as a six-week one and nothing below the
                  calendar moves when you change month. */}
          {Array.from(
            { length: 42 - refDate.getDay() - daysInMonth },
            (_, i) => (
              <View key={`tail-${i}`} style={styles.dayCell} />
            )
          )}
        </View>
      </View>

      {/* Icon-only, equal tiles like the stats row above. Each is
              disabled (dimmed) when it would open nothing this month. */}
      <View style={[styles.statsRow, styles.actionRow]}>
        {(
          [
            ['captions', 'What you said', captioned.length],
            ['reel', "Watch this month's clips", queueIds.length],
            ['favorites', 'Favorite moments', favorited.length],
          ] as const
        ).map(([kind, label, count]) => (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [
              styles.statTile,
              styles.actionTile,
              count === 0 && styles.actionTileDisabled,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              kind === 'reel'
                ? navigation.navigate('ClipView', {
                    clipId: queueIds[0],
                    queue: queueIds,
                  })
                : navigation.navigate('MonthList', {
                    kind,
                    clips,
                    monthLabel,
                  })
            }
            disabled={count === 0}
          >
            <NavIcon name={kind} size={30} color={t.accent} />
          </Pressable>
        ))}
      </View>
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
      paddingHorizontal: 24,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: t.textPrimary,
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
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    monthNavButtonDisabled: {
      opacity: 0.3,
    },
    monthLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.textPrimary,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    statTile: {
      flex: 1,
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 16,
      alignItems: 'center',
    },
    statValue: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: t.textPrimary,
    },
    statLabel: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: t.textMuted,
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
    weekday: {
      aspectRatio: undefined,
      paddingBottom: 6,
      textAlign: 'center',
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.xs,
      color: t.textMuted,
    },
    dayNumber: {
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      color: t.textPrimary,
    },
    dayDots: {
      flexDirection: 'row',
      gap: 4,
      marginTop: 4,
      height: 7,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    // edgeYou/edgePartner, not the accent tokens. These pips mean "you" and
    // "your partner" (on light the partner pip is only ~1.44:1 against the
    // background -- see edgePartner in themes.ts) -- and
    // `accent` deliberately flips hue with the theme, so using it here made
    // both pips orange in dark mode and destroyed the distinction the grid
    // exists to show.
    dotMine: {
      backgroundColor: t.edgeYou,
    },
    dotPartner: {
      backgroundColor: t.edgePartner,
    },
    pressed: {
      opacity: 0.7,
    },
    // Pinned to the bottom, above the tab bar: `middle` takes the rest.
    actionRow: {
      marginBottom: 36,
    },
    middle: {
      flex: 1,
      justifyContent: 'center',
    },
    // Padded to the stat tiles' height (~88pt) so the two rows match.
    actionTile: {
      paddingVertical: 29,
    },
    actionTileDisabled: {
      opacity: 0.4,
    },
  });
