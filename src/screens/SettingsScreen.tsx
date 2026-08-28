import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { formatDateString, parseDateString, todayDateString } from '@/lib/date';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { PairAnniversary } from '@/types';

export default function SettingsScreen() {
  const { session, pair, myProfile, refreshProfiles } = usePairing();
  const insets = useSafeAreaInsets();
  const [anniversary, setAnniversary] = useState<PairAnniversary | null>(null);
  const [editingAnniversary, setEditingAnniversary] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

  const loadAnniversary = useCallback(async () => {
    if (!pair) return;
    const { data, error } = await supabase
      .from('pair_anniversary')
      .select('*')
      .eq('pair_id', pair.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load anniversary:', error.message);
      return;
    }
    setAnniversary(data);
  }, [pair]);

  useFocusEffect(
    useCallback(() => {
      loadAnniversary();
    }, [loadAnniversary])
  );

  const startEditingAnniversary = () => {
    setPickerDate(parseDateString(anniversary?.anniversary_date));
    setEditingAnniversary(true);
  };

  const handleSaveAnniversary = async () => {
    if (!pair || !session?.user) return;
    // Replaces the picker's old maximumDate bound -- a future anniversary
    // would render a negative "N days together" on Home.
    if (formatDateString(pickerDate) > todayDateString()) {
      Alert.alert("That's in the future", 'Pick a date on or before today.');
      return;
    }
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
      console.error('Failed to save anniversary:', error.message);
      return;
    }
    setAnniversary(data);
    setEditingAnniversary(false);
  };

  const startEditingNickname = () => {
    setNicknameInput(myProfile?.display_name ?? '');
    setEditingNickname(true);
  };

  const handleSaveNickname = async () => {
    if (!session?.user) return;
    const trimmed = nicknameInput.trim();
    if (!trimmed) {
      Alert.alert('Nickname required', "It can't be blank.");
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', session.user.id);

    if (error) {
      console.error('Failed to save nickname:', error.message);
      return;
    }
    await refreshProfiles();
    setEditingNickname(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>Settings</Text>
      {session?.user.email && (
        <Text style={styles.email}>Signed in as {session.user.email}</Text>
      )}
      {editingNickname ? (
        <View style={styles.editCard}>
          <TextInput
            style={styles.nicknameInput}
            value={nicknameInput}
            onChangeText={setNicknameInput}
            placeholder="Your nickname"
            placeholderTextColor={colors.muted}
            autoFocus
            maxLength={20}
          />
          <Pressable
            style={({ pressed }) => [
              styles.pickerSave,
              pressed && styles.pressed,
            ]}
            onPress={handleSaveNickname}
          >
            <Text style={styles.pickerSaveText}>Save</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.pickerClose,
              pressed && styles.pressed,
            ]}
            onPress={() => setEditingNickname(false)}
          >
            <Text style={styles.pickerCloseText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={startEditingNickname}
        >
          <Text style={styles.rowLabel}>Nickname</Text>
          <Text style={styles.rowValue}>
            {myProfile?.display_name ?? '...'}
          </Text>
        </Pressable>
      )}
      {editingAnniversary ? (
        <View style={styles.editCard}>
          {/* No minimumDate/maximumDate: passing a `new Date()` (which carries
              a time component) as a bound to a mode="date" picker is the
              suspected cause of the Dec 31, 1969 display bug. Range is
              validated on save instead. */}
          <View style={Platform.OS === 'ios' ? styles.spinnerBox : undefined}>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => date && setPickerDate(date)}
            />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.pickerSave,
              pressed && styles.pressed,
            ]}
            onPress={handleSaveAnniversary}
          >
            <Text style={styles.pickerSaveText}>Save</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.pickerClose,
              pressed && styles.pressed,
            ]}
            onPress={() => setEditingAnniversary(false)}
          >
            <Text style={styles.pickerCloseText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={startEditingAnniversary}
        >
          <Text style={styles.rowLabel}>Anniversary</Text>
          <Text style={styles.rowValue}>
            {anniversary
              ? parseDateString(
                  anniversary.anniversary_date
                ).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Not set'}
          </Text>
        </Pressable>
      )}
      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.pressed,
        ]}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.ink,
    marginBottom: 8,
  },
  email: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  rowLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  rowValue: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  editCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 16,
  },
  nicknameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  // Fixed height so the native spinner never lays out with a zero-size
  // frame mid-transition -- iOS's UIDatePicker can reset its displayed
  // value to the Unix epoch if that happens.
  spinnerBox: {
    height: 216,
  },
  pickerSave: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  pickerSaveText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.surface,
  },
  pickerClose: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  pickerCloseText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.muted,
  },
  signOutButton: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.error,
  },
  pressed: {
    opacity: 0.7,
  },
});
