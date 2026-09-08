import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
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
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const spinnerColor = variant === 'primary' ? t.textOnAccent : t.textPrimary;

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

// makeStyles rather than a module-level StyleSheet.create: the object
// has to be rebuilt when the theme changes. useMemo at the call site
// keeps that to once per theme rather than once per render.
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    button: {
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: t.accentYou,
    },
    primaryButtonText: {
      fontFamily: fonts.bodySemiBold,
      color: t.textOnAccent,
      fontSize: fontSizes.md,
    },
    secondaryButton: {
      backgroundColor: t.fillPartner,
      borderWidth: 1,
      borderColor: t.edgePartner,
    },
    secondaryButtonText: {
      fontFamily: fonts.bodySemiBold,
      color: t.textPrimary,
      fontSize: fontSizes.md,
    },
    pressed: {
      opacity: 0.7,
    },
  });
