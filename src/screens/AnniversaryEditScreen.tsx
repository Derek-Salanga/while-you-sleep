import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { usePairAnniversary } from '@/hooks/queries';
import Screen from '@/components/ui/Screen';
import BackLink from '@/components/ui/BackLink';
import Button from '@/components/ui/Button';
import { todayDateString, formatDateString, parseDateString } from '@/lib/date';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';

// The anniversary editor, pushed from Settings' Anniversary row inside the
// Settings tab's stack -- the same shape as TripEditScreen. It used to be an
// inline card in Settings.
//
// Picker setup follows docs/datepicker-debugging.md: no Modal, no
// minimumDate/maximumDate (the range is checked on Save), a fixed-height
// spinner on iOS, and Android's dialog opened imperatively from a row.
export default function AnniversaryEditScreen({ navigation }: any) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { session, pair } = usePairing();
  const queryClient = useQueryClient();
  const { data: anniversary } = usePairAnniversary(pair?.id);

  // Seeded once from the cache. Settings disables the row until the query
  // has loaded, so this never starts from a placeholder.
  const [pickerDate, setPickerDate] = useState(() =>
    parseDateString(anniversary?.anniversary_date)
  );
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
    navigation.goBack();
  };

  return (
    <Screen padding={20} topInset>
      <BackLink label="Settings" />
      <Text style={styles.title}>Anniversary</Text>
      <Text style={styles.label}>When did you get together?</Text>

      {Platform.OS === 'android' && (
        <Pressable
          style={({ pressed }) => [styles.input, pressed && styles.pressed]}
          onPress={() =>
            // The imperative API rather than a mounted <DateTimePicker>: the
            // component opens Android's dialog from an effect keyed on its
            // onChange, so any re-render while mounted reopens it.
            DateTimePickerAndroid.open({
              value: pickerDate,
              mode: 'date',
              onChange: (_, date) => date && setPickerDate(date),
            })
          }
        >
          <Text style={styles.inputText}>
            {pickerDate.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </Pressable>
      )}
      {Platform.OS === 'ios' && (
        <View style={styles.spinnerBox}>
          <DateTimePicker
            // Follows the OS appearance by default, not the app's -- so a user
            // on System=dark with the app forced Light would get a dark picker
            // on a light sheet.
            themeVariant={t.name}
            value={pickerDate}
            mode="date"
            display="spinner"
            onChange={(_, date) => date && setPickerDate(date)}
          />
        </View>
      )}

      <View style={styles.save}>
        <Button
          title="Save"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
        />
      </View>
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
    input: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    inputText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      color: t.textPrimary,
    },
    // Fixed height so the native spinner never lays out with a zero-size
    // frame mid-transition -- iOS's UIDatePicker can reset its displayed
    // value to the Unix epoch if that happens.
    spinnerBox: {
      height: 216,
    },
    save: {
      marginTop: 20,
    },
    pressed: {
      opacity: 0.7,
    },
  });
