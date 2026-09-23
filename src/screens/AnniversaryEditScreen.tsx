import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { usePairAnniversary } from '@/hooks/queries';
import Screen from '@/components/ui/Screen';
import BackLink from '@/components/ui/BackLink';
import Button from '@/components/ui/Button';
import DateField from '@/components/ui/DateField';
import { todayDateString, formatDateString, parseDateString } from '@/lib/date';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';

// The anniversary editor, pushed from Settings' Anniversary row inside the
// Settings tab's stack -- the same shape as TripEditScreen. It used to be an
// inline card in Settings.
export default function AnniversaryEditScreen({ navigation }: any) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { session, pair } = usePairing();
  const queryClient = useQueryClient();
  const { data: anniversary, isError } = usePairAnniversary(pair?.id);

  // Null until the user touches the picker; until then it shows whatever the
  // cache holds, including a refetch that lands after this page opened (the
  // partner may have just changed it). A snapshot taken on mount would
  // quietly save the stale value back over theirs.
  const [picked, setPicked] = useState<Date | null>(null);
  const pickerDate = picked ?? parseDateString(anniversary?.anniversary_date);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!pair || !session?.user || saving) return;
    // Replaces the picker's old maximumDate bound -- a future anniversary
    // would render a negative "N days together" on Home.
    if (formatDateString(pickerDate) > todayDateString()) {
      Alert.alert("That's in the future", 'Pick a date on or before today.');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('pair_anniversary')
      .upsert(
        {
          pair_id: pair.id,
          anniversary_date: formatDateString(pickerDate),
          set_by: session.user.id,
        },
        { onConflict: 'pair_id' }
      )
      .select()
      .single();

    if (error) {
      setSaving(false);
      Alert.alert("Couldn't save your anniversary", error.message);
      return;
    }
    // The upsert already returned the saved row, so write it straight into
    // the cache rather than invalidating and going back for it.
    queryClient.setQueryData(['pairAnniversary', pair.id], data);
    // Only if still on screen: after a swipe-back mid-save, a GO_BACK from
    // here would bubble to the tab navigator and switch tabs.
    if (navigation.isFocused()) navigation.goBack();
  };

  return (
    <Screen padding={20} topInset>
      <BackLink label="Settings" />
      <Text style={styles.title}>Anniversary</Text>

      {/* The page waits for the query itself rather than relying on the
          caller to only open it once loaded. */}
      {anniversary === undefined ? (
        isError ? (
          <Text style={styles.error}>
            Couldn't load your anniversary. Go back and try again.
          </Text>
        ) : (
          <ActivityIndicator color={t.accent} />
        )
      ) : (
        <>
          <Text style={styles.label}>When did you get together?</Text>
          <DateField value={pickerDate} onChange={setPicked} />
          <View style={styles.save}>
            <Button
              title="Save"
              onPress={handleSave}
              loading={saving}
              disabled={saving}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

// makeStyles rather than a module-level StyleSheet.create: the object
// has to be rebuilt when the theme changes.
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    title: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: t.textPrimary,
      marginBottom: 24,
    },
    label: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.textPrimary,
      marginBottom: 8,
    },
    error: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.danger,
    },
    save: {
      marginTop: 20,
    },
  });
