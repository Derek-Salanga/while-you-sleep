import React from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

interface InputProps extends TextInputProps {
  centered?: boolean;
}

export default function Input({ centered, style, ...props }: InputProps) {
  return (
    <TextInput
      style={[styles.input, centered && styles.centered, style]}
      placeholderTextColor={colors.muted}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.ink,
    marginBottom: 16,
  },
  centered: {
    textAlign: 'center',
    letterSpacing: 4,
    fontSize: fontSizes.lg,
  },
});
