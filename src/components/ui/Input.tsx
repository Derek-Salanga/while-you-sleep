import React, { useMemo } from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';

interface InputProps extends TextInputProps {
  centered?: boolean;
}

export default function Input({ centered, style, ...props }: InputProps) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <TextInput
      style={[styles.input, centered && styles.centered, style]}
      placeholderTextColor={t.textMuted}
      {...props}
    />
  );
}

// makeStyles rather than a module-level StyleSheet.create: the object
// has to be rebuilt when the theme changes. useMemo at the call site
// keeps that to once per theme rather than once per render.
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    input: {
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      padding: 16,
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      color: t.textPrimary,
      marginBottom: 16,
    },
    centered: {
      textAlign: 'center',
      letterSpacing: 4,
      fontSize: fontSizes.lg,
    },
  });
