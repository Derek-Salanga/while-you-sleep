import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { colors } from '@/theme/colors';

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

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    // Without this React Native falls back to black. Masked until now
    // because the only non-elevated consumer (TimelineScreen) always passes
    // its own borderColor -- the next one would have found a black box.
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  pressed: {
    opacity: 0.7,
  },
});
