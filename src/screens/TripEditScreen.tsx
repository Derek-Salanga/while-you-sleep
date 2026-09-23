import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { usePairTrip } from '@/hooks/queries';
import { isTripUpcoming } from '@/components/HeroCard';
import Screen from '@/components/ui/Screen';
import { todayDateString, formatDateString, parseDateString } from '@/lib/date';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import { countries, flagEmoji, countryName } from '@/data/countries';

// The trip editor, pushed from Home's trip card inside the Home tab's own
// stack (so the tab bar stays). It used to replace the card in place, which
// with its 216pt iOS spinner pushed the rest of Home off-screen.
//
// Picker setup follows docs/datepicker-debugging.md: the DateTimePicker is
// never inside a Modal, has no minimumDate (the range is checked on Save),
// and sits in a fixed-height box on iOS. The Modal below is only the
// country list.
export default function TripEditScreen({ navigation }: any) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { session, pair } = usePairing();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: trip } = usePairTrip(pair?.id);

  // A past trip shows "Plan your next visit" on Home, so start from today
  // rather than the stale date, which Save would reject.
  const [pickerDate, setPickerDate] = useState(() =>
    isTripUpcoming(trip) ? parseDateString(trip?.target_date) : new Date()
  );
  const [pickerCountryCode, setPickerCountryCode] = useState<string | null>(
    trip?.country_code ?? null
  );
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const handleSave = async () => {
    if (!pair || !session?.user) return;
    // Enforced here rather than via the picker's minimumDate prop -- passing
    // a bound to the native date picker is what caused the Dec 31, 1969
    // display bug. Today itself is allowed ("Today" is a valid countdown).
    if (formatDateString(pickerDate) < todayDateString()) {
      Alert.alert(
        "That's in the past",
        'Pick today or a later date for your next trip.'
      );
      return;
    }
    const { data, error } = await supabase
      .from('pair_trips')
      .upsert(
        {
          pair_id: pair.id,
          target_date: formatDateString(pickerDate),
          country_code: pickerCountryCode,
          set_by: session.user.id,
        },
        { onConflict: 'pair_id' }
      )
      .select()
      .single();

    if (error) {
      Alert.alert("Couldn't save your trip", error.message);
      return;
    }
    // setQueryData rather than invalidate: the upsert already returned the
    // saved row, so Home and HeroCard show it the moment we go back.
    queryClient.setQueryData(['pairTrip', pair.id], data);
    navigation.goBack();
  };

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(query));
  }, [countrySearch]);

  return (
    <Screen padding={20} topInset>
      <Pressable
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back to Home"
      >
        <Text style={styles.backText}>‹ Home</Text>
      </Pressable>
      <Text style={styles.title}>Our next trip</Text>

      <Text style={styles.label}>Where are you meeting?</Text>
      <Pressable
        style={({ pressed }) => [styles.input, pressed && styles.pressed]}
        onPress={() => setCountryPickerVisible(true)}
      >
        <Text style={pickerCountryCode ? styles.inputText : styles.placeholder}>
          {pickerCountryCode
            ? `${flagEmoji(pickerCountryCode)}  ${countryName(pickerCountryCode)}`
            : 'Select a country'}
        </Text>
      </Pressable>

      <Text style={styles.label}>When?</Text>
      <View style={Platform.OS === 'ios' ? styles.spinnerBox : undefined}>
        <DateTimePicker
          // Follows the OS appearance by default, not the app's -- so a user
          // on System=dark with the app forced Light would get a dark picker
          // on a light sheet.
          themeVariant={t.name}
          value={pickerDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => date && setPickerDate(date)}
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.save, pressed && styles.pressed]}
        onPress={handleSave}
      >
        <Text style={styles.saveText}>Save</Text>
      </Pressable>

      <Modal
        visible={countryPickerVisible}
        animationType="slide"
        onRequestClose={() => setCountryPickerVisible(false)}
      >
        <View style={[styles.countryModal, { paddingTop: insets.top + 20 }]}>
          <TextInput
            style={[styles.input, styles.inputText]}
            placeholder="Search countries"
            placeholderTextColor={t.textMuted}
            value={countrySearch}
            onChangeText={setCountrySearch}
            autoFocus
          />
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.countryRow,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  setPickerCountryCode(item.code);
                  setCountryPickerVisible(false);
                  setCountrySearch('');
                }}
              >
                <Text style={styles.inputText}>
                  {flagEmoji(item.code)} {item.name}
                </Text>
              </Pressable>
            )}
          />
          <Pressable
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            onPress={() => {
              setCountryPickerVisible(false);
              setCountrySearch('');
            }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
}

// makeStyles rather than a module-level StyleSheet.create: the object
// has to be rebuilt when the theme changes.
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
      marginBottom: 20,
    },
    inputText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      color: t.textPrimary,
    },
    placeholder: {
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      color: t.textMuted,
    },
    // Fixed height so the native spinner never lays out with a zero-size
    // frame mid-transition -- iOS's UIDatePicker can reset its displayed
    // value to the Unix epoch if that happens.
    spinnerBox: {
      height: 216,
    },
    save: {
      backgroundColor: t.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 20,
    },
    saveText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.textOnAccent,
    },
    cancel: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    cancelText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.textMuted,
    },
    countryModal: {
      flex: 1,
      backgroundColor: t.background,
      paddingHorizontal: 20,
    },
    countryRow: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    pressed: {
      opacity: 0.7,
    },
  });
