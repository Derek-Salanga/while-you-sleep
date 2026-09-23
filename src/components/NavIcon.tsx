import React from 'react';
import Svg, { Circle, G, Path, Polygon, Line } from 'react-native-svg';

export type NavIconKey =
  | 'home'
  | 'timeline'
  | 'monthly'
  | 'settings'
  | 'captions'
  | 'reel'
  | 'favorites';

interface NavIconProps {
  name: NavIconKey;
  size?: number;
  color: string;
}

// The app's one icon set: stroked line icons on a 100x100 grid, all the same
// weight, so the tab bar and Monthly Summary's action row match. Replaced the
// hand-drawn filled paths (theme/navIcons.ts) on 2026-09-23.
export default function NavIcon({ name, size = 26, color }: NavIconProps) {
  const s = {
    stroke: color,
    strokeWidth: 7,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {name === 'home' && (
        <>
          <Path {...s} d="M12 48 L50 16 L88 48" />
          <Path
            {...s}
            d="M24 40 V80 A6 6 0 0 0 30 86 H70 A6 6 0 0 0 76 80 V40"
          />
          <Path {...s} d="M42 86 V64 H58 V86" />
        </>
      )}
      {name === 'timeline' && (
        <>
          <Circle {...s} cx={50} cy={50} r={36} />
          <Path {...s} d="M50 30 V50 L63 59" />
        </>
      )}
      {name === 'monthly' && (
        <>
          <Path
            {...s}
            d="M22 22 H78 A8 8 0 0 1 86 30 V78 A8 8 0 0 1 78 86 H22 A8 8 0 0 1 14 78 V30 A8 8 0 0 1 22 22 Z"
          />
          <Line {...s} x1={14} y1={42} x2={86} y2={42} />
          <Line {...s} x1={34} y1={12} x2={34} y2={30} />
          <Line {...s} x1={66} y1={12} x2={66} y2={30} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Polygon
            {...s}
            points="41.0,22.4 43.4,12.6 56.6,12.6 59.0,22.4 63.2,24.2 71.8,18.9 81.1,28.2 75.8,36.8 77.6,41.0 87.4,43.4 87.4,56.6 77.6,59.0 75.8,63.2 81.1,71.8 71.8,81.1 63.2,75.8 59.0,77.6 56.6,87.4 43.4,87.4 41.0,77.6 36.8,75.8 28.2,81.1 18.9,71.8 24.2,63.2 22.4,59.0 12.6,56.6 12.6,43.4 22.4,41.0 24.2,36.8 18.9,28.2 28.2,18.9 36.8,24.2"
          />
          <Circle {...s} cx={50} cy={50} r={12} />
        </>
      )}
      {name === 'captions' && (
        <Path
          {...s}
          d="M22 20 H78 A10 10 0 0 1 88 30 V60 A10 10 0 0 1 78 70 H46 L28 84 V70 H22 A10 10 0 0 1 12 60 V30 A10 10 0 0 1 22 20 Z"
        />
      )}
      {/* Lifted 3 so its centre (y 50) lines up with the bubble and star. */}
      {name === 'reel' && (
        <G y={-3}>
          <Path
            {...s}
            d="M16 48 H84 V80 A6 6 0 0 1 78 86 H22 A6 6 0 0 1 16 80 Z"
          />
          <Polygon {...s} points="14,38 78,20 81,31 17,49" />
          <Line {...s} x1="36" y1="33" x2="42" y2="42" />
          <Line {...s} x1="56" y1="27" x2="62" y2="36" />
        </G>
      )}
      {name === 'favorites' && (
        <Polygon
          {...s}
          points="50,14 58.8,39.9 86.2,40.9 64.3,57.6 72.2,84.1 50,68 27.8,84.1 35.7,57.6 13.8,40.9 41.2,39.9"
        />
      )}
    </Svg>
  );
}
