import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, TextInput, Modal, FlatList, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { todayDateString, formatDateString, parseDateString } from '@/lib/date';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';
import { PairTrip, PairAnniversary } from '@/types';
import { countries, flagEmoji, countryName } from '@/data/countries';

function daysBetween(fromDate: string, toDate: string): number {
  return Math.round(
    (new Date(toDate + 'T00:00:00').getTime() - new Date(fromDate + 'T00:00:00').getTime()) /
      86400000
  );
}

function tripCountdownLabel(targetDate: string): string {
  const diffDays = daysBetween(todayDateString(), targetDate);
  if (diffDays === 0) return 'Today';
  if (diffDays < 0) return `${-diffDays} days ago`;
  return `${diffDays} days`;
}

function formatLongDate(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function HomeScreen({ navigation }: any) {
  const { session, pair, partnerProfile } = usePairing();
  const insets = useSafeAreaInsets();
  const [answeredToday, setAnsweredToday] = useState(false);
  const [trip, setTrip] = useState<PairTrip | null>(null);
  const [anniversary, setAnniversary] = useState<PairAnniversary | null>(null);
  const [editingTrip, setEditingTrip] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerCountryCode, setPickerCountryCode] = useState<string | null>(null);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // The daily clip IS the daily question's answer now -- see "Video daily
  // question" in CLAUDE.md -- so "answered today" checks clips, not the
  // now-unused daily_answers table.
  const loadQuestionStatus = useCallback(async () => {
    if (!pair || !session?.user) return;
    const { data, error } = await supabase
      .from('clips')
      .select('id')
      .eq('pair_id', pair.id)
      .eq('sender_id', session.user.id)
      .eq('recorded_for_date', todayDateString())
      .maybeSingle();

    if (error) {
      console.error('Failed to load question status:', error.message);
      return;
    }
    setAnsweredToday(!!data);
  }, [pair, session]);

  const loadTrip = useCallback(async () => {
    if (!pair) return;
    const { data, error } = await supabase
      .from('pair_trips')
      .select('*')
      .eq('pair_id', pair.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load trip:', error.message);
      return;
    }
    setTrip(data);
  }, [pair]);

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
      loadQuestionStatus();
      loadTrip();
      loadAnniversary();
    }, [loadQuestionStatus, loadTrip, loadAnniversary])
  );

  const startEditingTrip = () => {
    setPickerDate(parseDateString(trip?.target_date));
    setPickerCountryCode(trip?.country_code ?? null);
    setEditingTrip(true);
  };

  const handleSaveTrip = async () => {
    if (!pair || !session?.user) return;
    // Enforced here rather than via the picker's minimumDate prop -- passing
    // a bound to the native date picker is what caused the Dec 31, 1969
    // display bug. Today itself is allowed ("Today" is a valid countdown).
    if (formatDateString(pickerDate) < todayDateString()) {
      Alert.alert("That's in the past", 'Pick today or a later date for your next trip.');
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
      console.error('Failed to save trip:', error.message);
      return;
    }
    setTrip(data);
    setEditingTrip(false);
  };

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(query));
  }, [countrySearch]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>Home</Text>
      {anniversary && (
        <Text style={styles.anniversaryText}>
          {daysBetween(anniversary.anniversary_date, todayDateString())} days together
          {partnerProfile ? ` with ${partnerProfile.display_name}` : ''}
        </Text>
      )}
      {/* The daily clip IS the daily question's answer now -- RecordScreen
          shows the question, records the (video) answer, and reveals both
          partners' answers once submitted. See "Video daily question" in
          CLAUDE.md; replaces the old separate text-answer + generic-clip
          entry points. */}
      <Pressable
        style={({ pressed }) => [styles.entryCard, pressed && styles.pressed]}
        onPress={() => navigation.navigate('Record')}
      >
        <Text style={styles.entryCardLabel}>Today's question</Text>
        {!answeredToday && <View style={styles.unwatchedDot} />}
      </Pressable>
      {editingTrip ? (
        <View style={styles.editCard}>
          <Text style={styles.tripCardTitle}>Our next trip</Text>
          <Text style={styles.pickerLabel}>Where are you meeting?</Text>
          <Pressable
            style={({ pressed }) => [styles.pickerInput, pressed && styles.pressed]}
            onPress={() => setCountryPickerVisible(true)}
          >
            <Text style={pickerCountryCode ? styles.pickerInputText : styles.pickerInputPlaceholder}>
              {pickerCountryCode
                ? `${flagEmoji(pickerCountryCode)}  ${countryName(pickerCountryCode)}`
                : 'Select a country'}
            </Text>
          </Pressable>
          {/* No minimumDate: see the matching comment in SettingsScreen.tsx.
              A past trip date already renders sensibly ("N days ago"), so
              there's nothing to validate on save here. */}
          <View style={Platform.OS === 'ios' ? styles.spinnerBox : undefined}>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => date && setPickerDate(date)}
            />
          </View>
          <Pressable
            style={({ pressed }) => [styles.pickerSave, pressed && styles.pressed]}
            onPress={handleSaveTrip}
          >
            <Text style={styles.pickerSaveText}>Save</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.pickerClose, pressed && styles.pressed]}
            onPress={() => setEditingTrip(false)}
          >
            <Text style={styles.pickerCloseText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.entryCard, pressed && styles.pressed]}
          onPress={startEditingTrip}
        >
          {trip ? (
            <View>
              <Text style={styles.tripDate}>
                {trip.country_code ? `${flagEmoji(trip.country_code)} ${countryName(trip.country_code)} · ` : ''}
                {formatLongDate(trip.target_date)}
              </Text>
              <Text style={styles.tripCountdown}>{tripCountdownLabel(trip.target_date)}</Text>
              <Text style={styles.tripCardTitle}>until we see each other again</Text>
            </View>
          ) : (
            <Text style={styles.entryCardLabel}>Plan your next visit</Text>
          )}
        </Pressable>
      )}
      <Modal
        visible={countryPickerVisible}
        animationType="slide"
        onRequestClose={() => setCountryPickerVisible(false)}
      >
        <View style={[styles.countryModal, { paddingTop: insets.top + 20 }]}>
          <TextInput
            style={styles.pickerInput}
            placeholder="Search countries"
            placeholderTextColor={colors.muted}
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
                style={({ pressed }) => [styles.countryRow, pressed && styles.pressed]}
                onPress={() => {
                  setPickerCountryCode(item.code);
                  setCountryPickerVisible(false);
                  setCountrySearch('');
                }}
              >
                <Text style={styles.countryRowText}>
                  {flagEmoji(item.code)}  {item.name}
                </Text>
              </Pressable>
            )}
          />
          <Pressable
            style={({ pressed }) => [styles.pickerClose, pressed && styles.pressed]}
            onPress={() => {
              setCountryPickerVisible(false);
              setCountrySearch('');
            }}
          >
            <Text style={styles.pickerCloseText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
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
  anniversaryText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginBottom: 16,
  },
  entryCard: {
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
  entryCardLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  tripCardTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginTop: 4,
  },
  tripCountdown: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  tripDate: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginBottom: 2,
  },
  unwatchedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  pressed: {
    opacity: 0.7,
  },
  editCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 16,
  },
  pickerLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.ink,
    marginBottom: 8,
  },
  pickerInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.ink,
    marginBottom: 12,
  },
  pickerInputText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  pickerInputPlaceholder: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.muted,
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
  countryModal: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  countryRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  countryRowText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
});
