import React, { useMemo } from 'react';
import {
  Alert,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Theme } from '@/theme/themes';
import { useTheme, useThemePreference } from '@/theme/ThemeContext';
import type { ThemePreference } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import Screen from '@/components/ui/Screen';
import BackLink from '@/components/ui/BackLink';
import { usePairing } from '@/lib/PairingContext';
import { supabase } from '@/lib/supabase';
import { usePetState } from '@/hooks/queries';
import type { PetSpecies } from '@/types';

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

const PET_OPTIONS: { value: PetSpecies; label: string }[] = [
  { value: 'cat', label: 'Cat' },
  { value: 'dog', label: 'Dog' },
];

export default function AppearanceSettingsScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { preference, setPreference } = useThemePreference();
  const { pair } = usePairing();
  const { data: pet } = usePetState(pair?.id);
  const queryClient = useQueryClient();
  const [savingSpecies, setSavingSpecies] = React.useState<PetSpecies | null>(
    null
  );

  const setPetSpecies = async (species: PetSpecies) => {
    if (pet?.species === species || savingSpecies) return;

    setSavingSpecies(species);

    const { error } = await supabase.rpc('set_pet_species', {
      new_species: species,
    });
    if (error) {
      setSavingSpecies(null);
      Alert.alert("Couldn't change pet", error.message);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['pet'] });
    setSavingSpecies(null);
  };

  return (
    <Screen padding={0} topInset>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BackLink label="Settings" />
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

        <Text style={styles.sectionTitle}>Shared pet</Text>
        <Text style={styles.sectionNote}>
          This choice belongs to both of you. Either partner can change it.
        </Text>

        {PET_OPTIONS.map((option) => {
          // Undefined is still loading. Once a row exists, missing species is
          // an old-server response and safely falls back to the original cat.
          const active =
            (savingSpecies ??
              (pet === undefined ? null : (pet?.species ?? 'cat'))) ===
            option.value;
          return (
            <Pressable
              key={option.value}
              style={({ pressed }) => [
                styles.row,
                active && styles.rowActive,
                pressed && styles.pressed,
              ]}
              disabled={savingSpecies !== null}
              onPress={() => setPetSpecies(option.value)}
              accessibilityRole="radio"
              accessibilityState={{
                selected: active,
                disabled: savingSpecies !== null,
              }}
              accessibilityHint="Changes the shared pet for both partners"
            >
              <Text style={styles.rowLabel}>{option.label}</Text>
              {active && <Text style={styles.check}>✓</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    content: { padding: 20, paddingBottom: 32 },
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
    sectionTitle: {
      fontFamily: fonts.display,
      fontSize: fontSizes.lg,
      color: t.textPrimary,
      marginTop: 28,
      marginBottom: 4,
    },
    sectionNote: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textMuted,
      lineHeight: 20,
      marginBottom: 12,
    },
    pressed: { opacity: 0.7 },
  });
