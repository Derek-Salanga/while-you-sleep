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
// `withdrawn` uses Tint, which sits only ~4% off `background` and would
// otherwise be nearly invisible on a white card. That's on purpose: it
// switches to an outline instead, so the most subdued state still reads as
// a pet waiting rather than as an empty space where one used to be.
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
  const outlined = mood === 'withdrawn';
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
      {outlined && (
        <Path
          d={PET_BODY}
          fill="none"
          stroke={colors.border}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      )}

      <G
        stroke={colors.ink}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={outlined ? 0.55 : 0.8}
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
