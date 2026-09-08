import React, { useMemo } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  elevated?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function Card({
  children,
  elevated = false,
  onPress,
  style,
}: CardProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const cardStyle = [styles.card, elevated && styles.elevated, style];

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [...cardStyle, pressed && styles.pressed]}
        onPress={onPress}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

// makeStyles rather than a module-level StyleSheet.create: the object
// has to be rebuilt when the theme changes. useMemo at the call site
// keeps that to once per theme rather than once per render.
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: 20,
      borderWidth: 1,
      // Without this React Native falls back to black. Masked until now
      // because the only non-elevated consumer (TimelineScreen) always passes
      // its own borderColor -- the next one would have found a black box.
      borderColor: t.border,
    },
    elevated: {
      backgroundColor: t.surface,
      borderColor: t.border,
      shadowColor: t.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 3,
    },
    pressed: {
      opacity: 0.7,
    },
  });
