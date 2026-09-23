import React, { useMemo } from 'react';
import { Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { usePairing } from '@/lib/PairingContext';
import { useFavorites } from '@/hooks/queries';
import { usePartnerName } from '@/hooks/usePartnerName';
import Screen from '@/components/ui/Screen';
import { Clip } from '@/types';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';

// Monthly Summary's "Favorite moments" and "What you said" lists, each on its
// own page so the summary itself fits without scrolling. One screen for both:
// they are the same list of clip rows with a different filter and label.
//
// `clips` is the month the summary already fetched, passed in rather than
// re-queried. Favorites are still read live from the shared query, so
// un-starring a clip in ClipView and coming back drops it from the list.
export default function MonthListScreen({ navigation, route }: any) {
  const { kind, clips, monthLabel } = route.params as {
    kind: 'favorites' | 'captions';
    clips: Clip[];
    monthLabel: string;
  };
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { session, pair, myProfile } = usePairing();
  const partnerName = usePartnerName();
  const { data: favorites } = useFavorites(pair?.id);

  const me = myProfile?.display_name ?? 'You';
  const them = partnerName ?? 'Your partner';

  const rows =
    kind === 'favorites'
      ? clips.filter((c) => favorites?.some((f) => f.clip_id === c.id))
      : clips.filter((c) => c.caption_text);

  function who(clip: Clip): string {
    if (kind === 'captions')
      return clip.sender_id === session?.user.id ? me : them;
    const clipFavorites = favorites?.filter((f) => f.clip_id === clip.id) ?? [];
    const mine = clipFavorites.some((f) => f.user_id === session?.user.id);
    const theirs = clipFavorites.some((f) => f.user_id !== session?.user.id);
    if (mine && theirs) return `${me} & ${partnerName ?? 'your partner'}`;
    return mine ? me : them;
  }

  return (
    <Screen padding={20} topInset>
      <Pressable
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back to Monthly Summary"
      >
        <Text style={styles.backText}>‹ {monthLabel}</Text>
      </Pressable>
      <Text style={styles.title}>
        {kind === 'favorites' ? 'Favorite moments' : 'What you said'}
      </Text>

      <ScrollView contentContainerStyle={styles.content}>
        {rows.length === 0 && (
          <Text style={styles.empty}>Nothing here this month.</Text>
        )}
        {rows.map((clip) => (
          // No `queue`: opening one row plays that clip on its own, with
          // manual controls and no auto-advance. The summary's reel button is
          // what plays the month through.
          <Pressable
            key={clip.id}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => navigation.navigate('ClipView', { clipId: clip.id })}
          >
            <Text style={styles.meta}>
              {kind === 'favorites' ? '★ ' : ''}
              {Number(clip.recorded_for_date.split('-')[2])}
              {'  ·  '}
              {who(clip)}
            </Text>
            {!!clip.caption_text && (
              <Text style={styles.caption}>{clip.caption_text}</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

// makeStyles rather than a module-level StyleSheet.create: the object
// has to be rebuilt when the theme changes.
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    back: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
      marginBottom: 4,
    },
    backText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      color: t.accent,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: t.textPrimary,
      marginBottom: 24,
    },
    content: {
      paddingBottom: 40,
    },
    empty: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textMuted,
    },
    row: {
      marginBottom: 16,
    },
    meta: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: t.textMuted,
      marginBottom: 2,
    },
    caption: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textPrimary,
      lineHeight: 20,
    },
    pressed: {
      opacity: 0.7,
    },
  });
