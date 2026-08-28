import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps) {
  const spinnerColor = variant === 'primary' ? colors.surface : colors.ink;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text
          style={
            variant === 'primary'
              ? styles.primaryButtonText
              : styles.secondaryButtonText
          }
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.surface,
    fontSize: fontSizes.md,
  },
  secondaryButton: {
    backgroundColor: colors.secondaryTint,
    borderWidth: 1,
    borderColor: colors.secondaryDark,
  },
  secondaryButtonText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.ink,
    fontSize: fontSizes.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
