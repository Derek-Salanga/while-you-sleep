import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Theme } from '@/theme/themes';
import { useTheme, useThemePreference } from '@/theme/ThemeContext';
import type { ThemePreference } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import Screen from '@/components/ui/Screen';

// Three options rather than a switch. A two-state toggle cannot express
// "follow the device", which is the default and what most people want --
// and once it has to be a list, saying so plainly beats a control whose off
// position secretly means something else.
//
// The descriptions exist because "System" is the only one whose behaviour
// isn't obvious from its name.
const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  detail: string;
}[] = [
  {
    value: 'system',
    label: 'System',
    detail: "Follows your device's appearance setting",
  },
  { value: 'light', label: 'Light', detail: 'Always the day palette' },
  { value: 'dark', label: 'Dark', detail: 'Always the night palette' },
];

export default function AppearanceSettingsScreen({
  navigation,
}: {
  navigation: any;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { preference, setPreference } = useThemePreference();

  return (
    <Screen padding={20} topInset>
      <Pressable
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back to Settings"
      >
        <Text style={styles.backText}>‹ Settings</Text>
      </Pressable>
      <Text style={styles.title}>Appearance</Text>

      {THEME_OPTIONS.map((option) => {
        const active = preference === option.value;
        return (
          <Pressable
            key={option.value}
            style={({ pressed }) => [
              styles.row,
              active && styles.rowActive,
              pressed && styles.pressed,
            ]}
            onPress={() => setPreference(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{option.label}</Text>
              <Text style={styles.rowDetail}>{option.detail}</Text>
            </View>
            {/* A checkmark rather than a filled row: the selected option has
                to stay readable, and tinting the whole row would fight the
                theme it is selecting. */}
            {active && <Text style={styles.check}>✓</Text>}
          </Pressable>
        );
      })}

      <Text style={styles.note}>
        Video playback and the camera stay dark whichever you choose.
      </Text>
    </Screen>
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
    title: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: t.textPrimary,
      marginBottom: 24,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 14,
      paddingHorizontal: 18,
      marginBottom: 12,
    },
    rowActive: {
      borderColor: t.accent,
      borderWidth: 2,
    },
    rowText: { flexShrink: 1 },
    rowLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.textPrimary,
    },
    rowDetail: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textMuted,
      marginTop: 2,
    },
    check: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.accent,
      marginLeft: 12,
    },
    note: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: t.textMuted,
      lineHeight: 17,
      marginTop: 8,
    },
    pressed: { opacity: 0.7 },
  });
