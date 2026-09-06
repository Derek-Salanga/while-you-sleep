import React from 'react';
import Svg, { Defs, ClipPath, Rect, Path, G } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { PetMood } from '@/types';
import {
  PET_BODY,
  PET_EYES,
  PET_MOUTH,
  PET_SLEEP_MARK,
} from '@/theme/petPaths';

// How saturated each half is, by mood. The palette's own steps rather than
// new colours -- see "Design identity" in CLAUDE.md, the scale is locked.
//
// `withdrawn` can safely use Tint -- which sits only ~4% off `background`
// and would vanish on its own -- because every mood carries an outline. The
// stroke holds the silhouette while the warmth drains out of the fill, which
// is exactly the reading we want: still here, still waiting, just faded.
const LOBE_FILL: Record<PetMood, { left: string; right: string }> = {
  thriving: { left: colors.secondary, right: colors.primary },
  content: { left: colors.secondaryLight, right: colors.primaryLight },
  sleepy: { left: colors.secondarySoft, right: colors.primarySoft },
  withdrawn: { left: colors.secondaryTint, right: colors.primaryTint },
};

interface PetProps {
  mood: PetMood;
  size?: number;
  // Pause, drawn over the current mood rather than replacing it.
  resting?: boolean;
}

// Fixed clip ids, same reasoning as CrossoverHeart: both definitions are
// identical, so two pets on one screen collide onto the same clip harmlessly.
export default function Pet({ mood, size = 120, resting = false }: PetProps) {
  const fill = LOBE_FILL[mood];
  // Closed eyes while resting, whatever the mood underneath -- the pet is
  // asleep, not feeling something new.
  const eyes = resting ? PET_EYES.withdrawn : PET_EYES[mood];

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <ClipPath id="petLeft">
          <Rect x="0" y="0" width="50" height="100" />
        </ClipPath>
        <ClipPath id="petRight">
          <Rect x="50" y="0" width="50" height="100" />
        </ClipPath>
      </Defs>

      {/* Left half is day-orange (your partner), right is night-blue (you) --
          the convention colors.ts documents. */}
      <Path d={PET_BODY} fill={fill.left} clipPath="url(#petLeft)" />
      <Path d={PET_BODY} fill={fill.right} clipPath="url(#petRight)" />
      {/* Outline on every mood, not just the faded one. It's what holds the
          silhouette when the fill drains toward Tint, and it's what makes
          this read as a drawn character rather than a coloured blob. */}
      <Path
        d={PET_BODY}
        fill="none"
        stroke={colors.ink}
        strokeWidth={1.6}
        strokeLinejoin="round"
        opacity={0.8}
      />

      <G
        stroke={colors.ink}
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.8}
      >
        <Path d={eyes} />
        <Path d={PET_MOUTH[mood]} />
      </G>

      {resting && (
        <Path
          d={PET_SLEEP_MARK}
          stroke={colors.muted}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </Svg>
  );
}
