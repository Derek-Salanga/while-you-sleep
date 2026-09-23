import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { usePairing } from '@/lib/PairingContext';
import { useClips, useReactions } from '@/hooks/queries';
import { useRetryAiProcessing } from '@/hooks/mutations';
import { sharedTodayDateString, sharedYesterdayDateString } from '@/lib/date';
import { AI_MOOD_EMOJI } from '@/lib/aiMood';
import { Clip } from '@/types';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import Screen from '@/components/ui/Screen';
import Card from '@/components/ui/Card';
import HeroCard from '@/components/HeroCard';
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
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { session, pair } = usePairing();
  // No useFocusEffect refetch anymore: the tab navigator unmounts this
  // screen on blur, so a tab switch remounts and refetches, and coming back
  // from ClipView refetches because marking a clip viewed invalidates
  // ['clips'].
  const { data: clips = [], isLoading, refetch, error } = useClips(pair?.id);
  // One request for the whole list rather than per card. At most one row
  // per person per clip, so this stays small.
  const { data: reactions = [] } = useReactions(pair?.id);
  const retryAi = useRetryAiProcessing();

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
    // The list is ordered by recorded_for_date, so both partners' clips for a
    // day are adjacent and one header covers them. No SectionList needed.
    const showDay =
      index === 0 ||
      clips[index - 1].recorded_for_date !== item.recorded_for_date;
    const aiDone = item.ai_status === 'completed';
    const cardReactions = reactions.filter((r) => r.clip_id === item.id);
    const hasAiRow =
      (aiDone && (item.ai_title || item.ai_mood || item.ai_summary)) ||
      (mine &&
        (item.ai_status === 'failed' || item.ai_status === 'unprocessable'));

    const entering = entranceDone.current
      ? undefined
      : FadeInDown.duration(ENTER_MS)
          .delay(Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS)
          .withInitialValues({
            transform: [{ translateY: ENTER_TRANSLATE_Y }],
          });

    return (
      <Animated.View entering={entering}>
        {showDay && (
          <Text
            style={[styles.dayHeader, index === 0 && styles.dayHeaderFirst]}
          >
            {formatClipDate(item.recorded_for_date)}
          </Text>
        )}
        <Card
          onPress={() => navigation.navigate('ClipView', { clipId: item.id })}
          style={[styles.card, mine ? styles.cardMine : styles.cardPartner]}
        >
          {/* One row: unwatched dot, caption, reactions. No name -- the
              side, fill and edge say whose card it is. The row only renders
              when it has something in it. */}
          {(unwatched || cardReactions.length > 0 || item.caption_text) && (
            <View
              style={[styles.cardTopRow, hasAiRow && styles.cardTopRowAbove]}
            >
              {unwatched && <View style={styles.unwatchedDot} />}
              <Text style={styles.cardCaption}>{item.caption_text}</Text>
              {/* Both sides' reactions, not just the partner's -- on your own
                  card theirs is the reply you want to see, and on theirs it's
                  a reminder of what you sent back. At most two. */}
              {cardReactions.map((r) => (
                <View
                  key={r.user_id}
                  style={[
                    styles.cardReaction,
                    r.user_id === session?.user.id
                      ? styles.cardReactionYou
                      : styles.cardReactionPartner,
                  ]}
                >
                  <Text style={styles.cardReactionEmoji}>{r.emoji}</Text>
                </View>
              ))}
            </View>
          )}
          {/* The AI block is one muted group under a ✦, so the mood emoji
              can't be read as a reaction and the summary can't be read as
              the caption. Title and mood render independently (a row can
              have one without the other) but share a line. */}
          {aiDone && (item.ai_title || item.ai_mood) && (
            <Text style={styles.cardAiTitle}>
              {['✦', item.ai_title, item.ai_mood && AI_MOOD_EMOJI[item.ai_mood]]
                .filter(Boolean)
                .join(' ')}
            </Text>
          )}
          {aiDone && item.ai_summary && (
            <Text style={styles.cardAiSummary} numberOfLines={2}>
              {item.ai_summary}
            </Text>
          )}
          {item.ai_status === 'failed' && mine && (
            <Pressable
              disabled={retryAi.isPending}
              style={({ pressed }) => pressed && styles.pressed}
              onPress={() =>
                retryAi.mutate(item.id, {
                  onError: (err: any) =>
                    Alert.alert("Couldn't retry", err.message),
                })
              }
            >
              <Text style={styles.cardAiFailed}>
                AI summary failed —{' '}
                <Text style={styles.cardAiRetry}>Retry</Text>
              </Text>
            </Pressable>
          )}
          {/* No Retry here: the file itself was rejected (e.g. no audio
              track), so re-running would fail identically. The RPC refuses
              it too -- this is the UI half of that same gate. */}
          {item.ai_status === 'unprocessable' && mine && (
            <>
              <Text style={[styles.cardAiFailed, styles.italic]}>
                AI summary unavailable for this clip
              </Text>
              {/* Only this status shows its reason: it's about the user's
                  own file ("No audio stream found in the file."), so it
                  explains why Retry isn't offered. A 'failed' clip's reason
                  is an HTTP body from our pipeline -- meaningless on a card,
                  so it stays in the row and the Telegram alert. First
                  sentence only: AssemblyAI trails off into file-type
                  detail. */}
              {item.ai_error && (
                <Text
                  style={[styles.cardAiError, styles.italic]}
                  numberOfLines={1}
                >
                  {item.ai_error.split('. ')[0]}
                </Text>
              )}
            </>
          )}
        </Card>
      </Animated.View>
    );
  }

  return (
    <Screen padding={20} topInset>
      <Text style={styles.title}>Timeline</Text>
      <HeroCard />
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={t.accent} size="large" />
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

// makeStyles rather than a module-level StyleSheet.create: the object has
// to be rebuilt when the theme changes.
//
// The 4pt left edges take edgeYou/edgePartner rather than the accent
// tokens, which flip hue with the theme. edgePartner is the brand orange in
// both themes and only ~1.44:1 on the light background (see themes.ts), so
// the edge isn't the accessible cue here: the side the card hangs off is.
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    title: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: t.textPrimary,
      marginBottom: 16,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { paddingBottom: 20 },
    // Once per day, not per card: both partners' clips for a day sit under
    // it, which is also what makes a day only one of you posted on visible
    // at a glance (one card under the header instead of two).
    dayHeader: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
      color: t.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: 20,
      marginBottom: 8,
    },
    dayHeaderFirst: {
      marginTop: 8,
    },
    card: {
      padding: 18,
      marginBottom: 8,
    },
    // Whose card it is has three signals: the side it hangs off, the fill
    // and a 4pt edge in the full-strength colour. The tints these used to be
    // filled with sat ~4% off `background`, so at a glance the whole feed
    // read as one column of white cards.
    //
    // The fill is what carries at a glance (area beats a line); the edge is
    // the one that clears 3:1 for anyone the wash doesn't reach. The fill
    // stays soft rather than saturated so it doesn't compete with HeroCard,
    // which sits directly above the list already in full-strength
    // primary/secondary.
    //
    // 80% width, yours right and theirs left. Full width was tried on
    // 2026-09-21 and reverted two days later, once names came off the card
    // and the side became the only non-colour cue for whose clip it is.
    //
    // borderLeftWidth/Color override the 1pt border Card sets, since this
    // style is merged last (see ui/Card.tsx).
    cardMine: {
      backgroundColor: t.fillYou,
      borderColor: t.fillYou,
      borderLeftWidth: 4,
      borderLeftColor: t.edgeYou,
      alignSelf: 'flex-end',
      width: '80%',
    },
    cardPartner: {
      backgroundColor: t.fillPartner,
      borderColor: t.fillPartner,
      borderLeftWidth: 4,
      borderLeftColor: t.edgePartner,
      alignSelf: 'flex-start',
      width: '80%',
    },
    // flex-start so a multi-line caption keeps the dot and reactions on its
    // first line; the dot's marginTop centres it on that line.
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    cardTopRowAbove: {
      marginBottom: 10,
    },
    // A circle in the reactor's colour -- blue you, orange partner, the
    // same code as the card edges -- so each emoji says who left it. The
    // negative margin centres the 26pt circle on the caption's 22pt line.
    cardReaction: {
      width: 26,
      height: 26,
      borderRadius: 13,
      marginVertical: -2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardReactionYou: {
      backgroundColor: t.edgeYou,
    },
    cardReactionPartner: {
      backgroundColor: t.edgePartner,
    },
    cardReactionEmoji: {
      fontSize: 14,
    },
    // Leads the row, where Mail and Messages put their unread dot -- it
    // used to trail the reactions at the far end of the row, where an 8pt
    // dot beside 16pt emoji read as a stray.
    unwatchedDot: {
      marginTop: 7,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.danger,
    },
    cardAiTitle: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.sm,
      color: t.textMuted,
    },
    // Capped at two lines here only; ClipViewScreen shows it in full. The
    // summary is secondary and was what made processed cards tall.
    cardAiSummary: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textMuted,
      lineHeight: 20,
      marginTop: 2,
    },
    cardAiFailed: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: t.textMuted,
    },
    cardAiRetry: {
      fontFamily: fonts.bodySemiBold,
      color: t.accent,
    },
    cardAiError: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: t.textMuted,
      marginTop: 2,
    },
    pressed: {
      opacity: 0.7,
    },
    // The largest text on the card: the caption is the content, everything
    // else is about it. Not truncated: captions are short by design, and
    // ClipViewScreen shows the same text in full.
    cardCaption: {
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      color: t.textPrimary,
      lineHeight: 22,
      // Fills the row even when empty, which pushes the reactions right.
      flex: 1,
    },
    italic: {
      fontFamily: fonts.bodyItalic,
    },
    empty: {
      fontFamily: fonts.body,
      color: t.textMuted,
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
      color: t.textPrimary,
      textAlign: 'center',
      marginTop: 20,
    },
    emptyBody: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textMuted,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
  });
