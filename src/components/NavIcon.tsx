import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { NAV_ICON_PATHS, NavIconKey } from '@/theme/navIcons';

interface NavIconProps {
  name: NavIconKey;
  size?: number;
  color: string;
}

// Each icon is one filled path (never stroked) — that's what preserves the
// hand-drawn pressure variation from the design canvas source.
export default function NavIcon({ name, size = 26, color }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d={NAV_ICON_PATHS[name]} fill={color} />
    </Svg>
  );
}
