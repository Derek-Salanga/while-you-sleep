import React from 'react';
import Svg, { Defs, ClipPath, Rect, Path } from 'react-native-svg';
import { colors } from '@/theme/colors';

// The "Crossover Split" motif from assets/icon-1024.png, as vector. No SVG
// source for the icon is checked in (it's a raster only), so this is a plain
// symmetric heart silhouette split down the middle, with each half taking the
// opposite partner's color -- which is what the icon itself does.
const HEART_PATH =
  'M12,21.35l-1.45-1.32C5.4,15.36,2,12.28,2,8.5C2,5.42,4.42,3,7.5,3' +
  'c1.74,0,3.41,0.81,4.5,2.09C13.09,3.81,14.76,3,16.5,3C19.58,3,22,5.42,22,8.5' +
  'c0,3.78-3.4,6.86-8.55,11.54L12,21.35z';

// Fixed clip ids are safe even with several hearts on one screen: both
// definitions are identical, so a collision resolves to the same clip.
export default function CrossoverHeart({ size = 88 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <ClipPath id="crossoverHeartLeft">
          <Rect x="0" y="0" width="12" height="24" />
        </ClipPath>
        <ClipPath id="crossoverHeartRight">
          <Rect x="12" y="0" width="12" height="24" />
        </ClipPath>
      </Defs>
      <Path
        d={HEART_PATH}
        fill={colors.secondary}
        clipPath="url(#crossoverHeartLeft)"
      />
      <Path
        d={HEART_PATH}
        fill={colors.primary}
        clipPath="url(#crossoverHeartRight)"
      />
    </Svg>
  );
}
