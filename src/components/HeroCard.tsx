import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, ClipPath, Rect, Path } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

// No bespoke heart path exists in this repo -- assets/icon-1024.png (the
// "Crossover Split" icon colors.ts refers to) is a raster only, with no SVG
// source checked in. This is a plain, symmetric heart silhouette (Material's
// "favorite" glyph, 24x24 viewBox) split down the middle and colored to match
// what the icon actually does: each heart half takes the *opposite* side's
// background color, not its own.
const HEART_PATH =
  'M12,21.35l-1.45-1.32C5.4,15.36,2,12.28,2,8.5C2,5.42,4.42,3,7.5,3' +
  'c1.74,0,3.41,0.81,4.5,2.09C13.09,3.81,14.76,3,16.5,3C19.58,3,22,5.42,22,8.5' +
  'c0,3.78-3.4,6.86-8.55,11.54L12,21.35z';

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
        <Svg width={HEART_SIZE} height={HEART_SIZE} viewBox="0 0 24 24">
          <Defs>
            <ClipPath id="heartLeft">
              <Rect x="0" y="0" width="12" height="24" />
            </ClipPath>
            <ClipPath id="heartRight">
              <Rect x="12" y="0" width="12" height="24" />
            </ClipPath>
          </Defs>
          <Path d={HEART_PATH} fill={colors.secondary} clipPath="url(#heartLeft)" />
          <Path d={HEART_PATH} fill={colors.primary} clipPath="url(#heartRight)" />
        </Svg>
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
