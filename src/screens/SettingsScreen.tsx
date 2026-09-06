import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import {
  formatDateString,
  parseDateString,
  todayDateString,
  sharedTodayDateString,
  sharedDatePlusDays,
} from '@/lib/date';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePairAnniversary,
  usePartnerNickname,
  usePetState,
} from '@/hooks/queries';
import { useSetPetPause } from '@/hooks/mutations';
import { usePartnerName } from '@/hooks/usePartnerName';

// Presets, not a date picker. A picker buys nothing over three buttons
// here -- nobody needs to pause until an exact arbitrary date -- and this
// repo has six documented rounds of real-device crashes from
// @react-native-community/datetimepicker (docs/datepicker-debugging.md).
// Smaller diff and the safer one.
//
// "Until I turn it back on" is a year out rather than a null sentinel:
// paused_until null already means "not paused", so an open-ended pause
// needs a real date, and a year is indistinguishable from forever for a
// couple deciding to step away.
const PAUSE_PRESETS: { label: string; days: number }[] = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: 'Until I turn it back on', days: 365 },
];

export default function SettingsScreen({ navigation }: any) {
  const { session, pair, myProfile, refreshProfiles } = usePairing();
  const insets = useSafeAreaInsets();
  // Cached rather than useState + useFocusEffect: unmountOnBlur remounts
  // this screen on every tab visit, so local state reset to null each time
  // and the row rendered "Not set" while loading -- indistinguishable from
  // genuinely unset. The cache serves the previous value on remount instead.
  const { data: anniversary } = usePairAnniversary(pair?.id);
  const [editingAnniversary, setEditingAnniversary] = useState(false);
  const { data: pet } = usePetState(pair?.id);
  const setPetPause = useSetPetPause();
  const [editingPause, setEditingPause] = useState(false);
  const pausedUntil =
    pet?.paused_until && pet.paused_until >= sharedTodayDateString()
      ? pet.paused_until
      : null;
  const [pickerDate, setPickerDate] = useState(new Date());
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const queryClient = useQueryClient();
  const { data: partnerNickname } = usePartnerNickname(session?.user.id);
  const partnerName = usePartnerName();
  const [editingPartnerNickname, setEditingPartnerNickname] = useState(false);
  const [partnerNicknameInput, setPartnerNicknameInput] = useState('');

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
    // The upsert already returned the saved row, so write it straight into
    // the cache rather than invalidating and going back for it.
    queryClient.setQueryData(['pairAnniversary', pair.id], data);
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

  const startEditingPartnerNickname = () => {
    setPartnerNicknameInput(partnerNickname?.nickname ?? '');
    setEditingPartnerNickname(true);
  };

  // Blank clears the nickname rather than erroring, which is why there's no
  // separate "remove" affordance -- the display then falls back to whatever
  // your partner set for themselves. A blank string is unstorable anyway
  // (the check constraint's lower bound), so deleting is the only way to
  // express "unset".
  const handleSavePartnerNickname = async () => {
    if (!session?.user) return;
    const trimmed = partnerNicknameInput.trim();

    const { error } = trimmed
      ? await supabase
          .from('partner_nicknames')
          .upsert(
            { owner_id: session.user.id, nickname: trimmed },
            { onConflict: 'owner_id' }
          )
      : await supabase
          .from('partner_nicknames')
          .delete()
          .eq('owner_id', session.user.id);

    if (error) {
      console.error('Failed to save partner nickname:', error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['partnerNickname'] });
    setEditingPartnerNickname(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>Settings</Text>
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
          <Text style={styles.rowLabel}>Your name</Text>
          <Text style={styles.rowValue}>
            {myProfile?.display_name ?? '...'}
          </Text>
        </Pressable>
      )}
      {editingPartnerNickname ? (
        <View style={styles.editCard}>
          <Text style={styles.editHint}>
            Only you can see this. Leave it blank to go back to the name they
            set for themselves.
          </Text>
          <TextInput
            style={styles.nicknameInput}
            value={partnerNicknameInput}
            onChangeText={setPartnerNicknameInput}
            placeholder="What you call them"
            placeholderTextColor={colors.muted}
            autoFocus
            maxLength={20}
          />
          <Pressable
            style={({ pressed }) => [
              styles.pickerSave,
              pressed && styles.pressed,
            ]}
            onPress={handleSavePartnerNickname}
          >
            <Text style={styles.pickerSaveText}>Save</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.pickerClose,
              pressed && styles.pressed,
            ]}
            onPress={() => setEditingPartnerNickname(false)}
          >
            <Text style={styles.pickerCloseText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={startEditingPartnerNickname}
        >
          <Text style={styles.rowLabel}>Name for them</Text>
          <Text style={styles.rowValue}>{partnerName ?? '...'}</Text>
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
      {editingPause ? (
        <View style={styles.editCard}>
          <Text style={styles.rowLabel}>Pause the pet</Text>
          <Text style={styles.pauseHint}>
            It waits where it is — no decay, no reminders.
          </Text>
          {PAUSE_PRESETS.map((preset) => (
            <Pressable
              key={preset.label}
              style={({ pressed }) => [
                styles.pauseOption,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                setPetPause.mutate(sharedDatePlusDays(preset.days), {
                  onError: (err: any) =>
                    Alert.alert("Couldn't pause", err.message),
                });
                setEditingPause(false);
              }}
            >
              <Text style={styles.pauseOptionText}>{preset.label}</Text>
            </Pressable>
          ))}
          {pausedUntil && (
            <Pressable
              style={({ pressed }) => [
                styles.pauseOption,
                pressed && styles.pressed,
              ]}
              // null resumes -- clearing the date IS resuming, so there's no
              // separate endpoint and no separate button state to keep true.
              onPress={() => {
                setPetPause.mutate(null, {
                  onError: (err: any) =>
                    Alert.alert("Couldn't resume", err.message),
                });
                setEditingPause(false);
              }}
            >
              <Text style={styles.pauseResumeText}>Resume now</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.pickerClose,
              pressed && styles.pressed,
            ]}
            onPress={() => setEditingPause(false)}
          >
            <Text style={styles.pickerCloseText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => setEditingPause(true)}
        >
          <Text style={styles.rowLabel}>Pause</Text>
          <Text style={styles.rowValue}>
            {pausedUntil
              ? `Until ${parseDateString(pausedUntil).toLocaleDateString(
                  'en-US',
                  { month: 'short', day: 'numeric' }
                )}`
              : 'Off'}
          </Text>
        </Pressable>
      )}
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => navigation.navigate('AccountSettings')}
      >
        <Text style={styles.rowLabel}>Account</Text>
        <Text style={styles.rowValue}>›</Text>
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
    marginBottom: 24,
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
  pauseHint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 12,
  },
  pauseOption: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pauseOptionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.primary,
  },
  pauseResumeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.secondaryDark,
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
  editHint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.muted,
    lineHeight: 17,
    marginBottom: 12,
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
  pressed: {
    opacity: 0.7,
  },
});
