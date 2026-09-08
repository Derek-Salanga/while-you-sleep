import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePairing } from '@/lib/PairingContext';
import { usePairTrip, usePairAnniversary } from '@/hooks/queries';
import { todayDateString, daysBetween } from '@/lib/date';
import { flagEmoji, countryName } from '@/data/countries';
import { Theme, brand } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import CrossoverHeart from '@/components/CrossoverHeart';

const HEART_SIZE = 56;

function formatLongDate(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// Everything here comes from rows the pair has actually set. This card used
// to show a hardcoded "Day 14" and literal "Your city"/"Partner's city",
// which read as real data at a glance -- there is no "days apart" concept in
// the schema and `profiles` has no location column, so there was nothing to
// wire those to.
//
// Falls back through what exists: an upcoming trip, else the anniversary,
// else no text at all. An empty split card with the heart is honest; invented
// numbers are not.
export default function HeroCard() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { pair } = usePairing();
  const { data: trip } = usePairTrip(pair?.id);
  const { data: anniversary } = usePairAnniversary(pair?.id);

  const today = todayDateString();
  // A trip already in the past is skipped rather than counted upward, so the
  // card doesn't sit on a stale date once the visit has happened.
  const daysToTrip = trip ? daysBetween(today, trip.target_date) : null;
  const showTrip = daysToTrip !== null && daysToTrip >= 0;

  let count: string | null = null;
  let caption: string | null = null;
  let detailTop: string | null = null;
  let detailBottom: string | null = null;

  if (showTrip && trip) {
    count = daysToTrip === 0 ? 'Today' : `${daysToTrip} days`;
    caption = daysToTrip === 0 ? 'we meet' : 'until we meet';
    detailTop = trip.country_code
      ? `${flagEmoji(trip.country_code)} ${countryName(trip.country_code)}`
      : null;
    detailBottom = formatLongDate(trip.target_date);
  } else if (anniversary) {
    count = `${daysBetween(anniversary.anniversary_date, today)} days`;
    caption = 'together';
    detailTop = 'since';
    detailBottom = formatLongDate(anniversary.anniversary_date);
  }

  return (
    <View style={styles.card}>
      <View style={[styles.half, styles.leftHalf]}>
        {count && <Text style={styles.count}>{count}</Text>}
        {caption && <Text style={styles.caption}>{caption}</Text>}
      </View>
      <View style={[styles.half, styles.rightHalf]}>
        {detailTop && (
          <Text style={styles.detail} numberOfLines={1} ellipsizeMode="tail">
            {detailTop}
          </Text>
        )}
        {detailBottom && (
          <Text style={styles.detail} numberOfLines={1} ellipsizeMode="tail">
            {detailBottom}
          </Text>
        )}
      </View>
      <View style={styles.heart} pointerEvents="none">
        <CrossoverHeart size={HEART_SIZE} />
      </View>
    </View>
  );
}

// makeStyles rather than a module-level StyleSheet.create: the object has
// to be rebuilt when the theme changes. The two half fills come from
// `brand`, not the theme -- they encode you/partner and are identical in
// both -- but the text colours on them are tokens.
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      height: 120,
      borderRadius: 20,
      overflow: 'hidden',
      marginBottom: 20,
    },
    half: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    // Deepened from `primary`. The text here is white, and white on the base
    // blue is 3.37:1 -- fine for the 28pt count, which is WCAG large, but not
    // for the 16pt caption beside it. On primaryDark both get 5.20.
    leftHalf: {
      backgroundColor: brand.youDeep,
      alignItems: 'flex-start',
    },
    rightHalf: {
      backgroundColor: brand.partner,
      alignItems: 'flex-end',
    },
    count: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: t.textOnYou,
    },
    caption: {
      fontFamily: fonts.displayItalic,
      fontSize: fontSizes.md,
      color: t.textOnYou,
      marginTop: 2,
    },
    detail: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.sm,
      // Ink, not white. White on the day-orange is 1.55:1 -- the worst pairing
      // in the app -- and no lightening of the text or darkening of the orange
      // closes a gap that size. Ink gets 8.95. This works because the small
      // text is confined to this half; if either half ever has to carry the
      // other's text colour, a scrim behind the text is the way out.
      color: t.textOnPartner,
      textAlign: 'right',
    },
    heart: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginLeft: -HEART_SIZE / 2,
      marginTop: -HEART_SIZE / 2,
    },
  });
