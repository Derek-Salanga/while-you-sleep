import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';

// The "‹ Label" link at the top of a pushed sub-screen. One copy so they
// can't drift in padding, colour or accessibility wiring. hitSlop brings the
// ~30pt-tall text up to a comfortable tap target without moving the layout.
export default function BackLink({ label }: { label: string }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const navigation = useNavigation();

  return (
    <Pressable
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      onPress={() => navigation.goBack()}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
    >
      <Text style={styles.backText}>‹ {label}</Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    back: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
      marginBottom: 4,
    },
    backText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      color: t.accent,
    },
    pressed: {
      opacity: 0.7,
    },
  });
