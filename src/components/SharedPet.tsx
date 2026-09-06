import React from 'react';
import Svg, { Defs, ClipPath, Rect, Path, G } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { PetMood } from '@/types';
import {
  PET_BODY,
  PET_EYES,
  PET_MOUTH,
  PET_LINE,
  PET_SLEEP_MARK,
} from '@/theme/petPaths';

interface SharedPetProps {
  mood: PetMood;
  size?: number;
  // Day-orange for your partner, night-blue for you -- the convention
  // colors.ts documents. Overridable so a caller can dim the pet without
  // this component needing to know why.
  leftColor?: string;
  rightColor?: string;
  // The silhouette holds together without it, so it's a choice rather than
  // a requirement -- but it's what keeps the pet reading as drawn rather
  // than as two flat shapes meeting at a seam.
  outlined?: boolean;
  // Pause, drawn over the current mood rather than replacing it.
  resting?: boolean;
}

// Fixed clip ids, same reasoning as CrossoverHeart: both definitions are
// identical, so two pets on one screen collide onto the same clip harmlessly.
export default function SharedPet({
  mood,
  size = 120,
  leftColor = colors.secondary,
  rightColor = colors.primary,
  outlined = true,
  resting = false,
}: SharedPetProps) {
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

      <Path d={PET_BODY} fill={leftColor} clipPath="url(#petLeft)" />
      <Path d={PET_BODY} fill={rightColor} clipPath="url(#petRight)" />
      {outlined && (
        <Path
          d={PET_BODY}
          fill="none"
          stroke={PET_LINE}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      )}

      <G
        stroke={PET_LINE}
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
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
