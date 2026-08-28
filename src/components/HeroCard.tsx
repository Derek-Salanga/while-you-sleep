import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import CrossoverHeart from '@/components/CrossoverHeart';

const HEART_SIZE = 56;

// Placeholder data: no schema field backs either of these yet.
// - dayCount: there's no "days apart" concept in the schema -- pair_anniversary
//   tracks the opposite (days *together*), and pair_trips has no history, just
//   one upcoming date. Wire this up once it's decided what "apart" should count.
// - cities: `profiles` has no per-partner location field.
const PLACEHOLDER_DAY_COUNT = 14;
const PLACEHOLDER_MY_CITY = 'Your city';
const PLACEHOLDER_PARTNER_CITY = "Partner's city";

export default function HeroCard() {
  return (
    <View style={styles.card}>
      <View style={[styles.half, styles.leftHalf]}>
        <Text style={styles.dayCount}>Day {PLACEHOLDER_DAY_COUNT}</Text>
        <Text style={styles.dayLabel}>apart</Text>
      </View>
      <View style={[styles.half, styles.rightHalf]}>
        <Text style={styles.city}>{PLACEHOLDER_MY_CITY}</Text>
        <Text style={styles.city}>{PLACEHOLDER_PARTNER_CITY}</Text>
      </View>
      <View style={styles.heart} pointerEvents="none">
        <CrossoverHeart size={HEART_SIZE} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  leftHalf: {
    backgroundColor: colors.primary,
    alignItems: 'flex-start',
  },
  rightHalf: {
    backgroundColor: colors.secondary,
    alignItems: 'flex-end',
  },
  dayCount: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.surface,
  },
  dayLabel: {
    fontFamily: fonts.displayItalic,
    fontSize: fontSizes.md,
    color: colors.surface,
    marginTop: 2,
  },
  city: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.surface,
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
