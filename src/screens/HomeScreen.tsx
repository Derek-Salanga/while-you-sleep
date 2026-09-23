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
  ScrollView,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { usePartnerName } from '@/hooks/usePartnerName';
import { useQueryClient } from '@tanstack/react-query';
import {
  useClips,
  usePairTrip,
  usePairAnniversary,
  usePetState,
} from '@/hooks/queries';
import SharedPet from '@/components/SharedPet';
import HeroCard, { isTripUpcoming } from '@/components/HeroCard';
import { petMood, PetMood } from '@/types';
import {
  todayDateString,
  sharedTodayDateString,
  formatDateString,
  parseDateString,
  daysBetween,
} from '@/lib/date';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';
import { countries, flagEmoji, countryName } from '@/data/countries';

// What the pet card says. Every line is phrased as a state of the pair, not
// an instruction to the reader -- "it's been quiet" rather than "you haven't
// posted". A shared pet that nags is just a streak counter with a face, and
// the guilt dynamic is the thing this feature exists to avoid.
const PET_COPY: Record<PetMood, { title: string; body: string }> = {
  thriving: { title: 'Thriving', body: "You've both been showing up." },
  content: { title: 'Doing well', body: 'Keep it going.' },
  sleepy: {
    title: 'Getting sleepy',
    body: "It's been a quiet couple of days.",
  },
  withdrawn: {
    title: 'Waiting for you both',
    body: 'A day from each of you brings it back.',
  },
};

export default function HomeScreen({ navigation }: any) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { session, pair } = usePairing();
  const partnerName = usePartnerName();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  // These used to be useState + useFocusEffect fetches. Because
  // unmountOnBlur remounts this screen on every tab visit, that state reset
  // to its falsy default each time and the screen rendered "Plan your next
  // visit" and a hidden anniversary line as though they were loaded data --
  // a flash of *wrong* content, not of blank space. Reading the react-query
  // cache instead means a remount renders the previous value immediately and
  // refetches behind it, so the flash only exists on a cold start.
  const { data: trip } = usePairTrip(pair?.id);
  const { data: anniversary } = usePairAnniversary(pair?.id);
  // Derived from the clips list rather than its own query: TimelineScreen
  // already populates ['clips', pairId], so arriving from that tab costs no
  // request at all. `undefined` while loading is load-bearing -- see the dot
  // below.
  const { data: clips } = useClips(pair?.id);
  const answeredToday =
    clips === undefined
      ? undefined
      : clips.some(
          (c) =>
            c.sender_id === session?.user.id &&
            c.recorded_for_date === sharedTodayDateString()
        );
  const tripUpcoming = isTripUpcoming(trip);
  const [editingTrip, setEditingTrip] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerCountryCode, setPickerCountryCode] = useState<string | null>(
    null
  );
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const { data: pet } = usePetState(pair?.id);
  // Paused is a status laid over the current mood, not a mood of its own --
  // "we're travelling" must not read as a worse state of wellbeing.
  const petResting =
    !!pet?.paused_until && pet.paused_until >= sharedTodayDateString();
  const mood = pet ? petMood(pet.score) : null;

  const recordCtaScale = useSharedValue(1);
  const recordCtaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordCtaScale.value }],
  }));
  const handleRecordCtaPressIn = () => {
    recordCtaScale.value = withTiming(0.96, { duration: 100 });
  };
  const handleRecordCtaPressOut = () => {
    recordCtaScale.value = withTiming(1, { duration: 100 });
  };

  const startEditingTrip = () => {
    // A past trip shows "Plan your next visit", so the editor starts from
    // today rather than the stale date, which Save would reject.
    setPickerDate(
      tripUpcoming ? parseDateString(trip?.target_date) : new Date()
    );
    setPickerCountryCode(trip?.country_code ?? null);
    setEditingTrip(true);
  };

  const handleSaveTrip = async () => {
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
      console.error('Failed to save trip:', error.message);
      return;
    }
    // setQueryData rather than invalidate: the upsert already returned the
    // saved row, so there's nothing to go back for.
    queryClient.setQueryData(['pairTrip', pair.id], data);
    setEditingTrip(false);
  };

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(query));
  }, [countrySearch]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      {/* Scrolls only when it has to -- the trip editor with its 216pt
          spinner doesn't fit above the pinned question otherwise. */}
      <ScrollView
        style={styles.body}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Home</Text>
        {anniversary && (
          <Text style={styles.anniversaryText}>
            {daysBetween(anniversary.anniversary_date, todayDateString())} days
            together
            {partnerName ? ` with ${partnerName}` : ''}
          </Text>
        )}
        {editingTrip ? (
          <View style={styles.editCard}>
            <Text style={styles.tripCardTitle}>Our next trip</Text>
            <Text style={styles.pickerLabel}>Where are you meeting?</Text>
            <Pressable
              style={({ pressed }) => [
                styles.pickerInput,
                pressed && styles.pressed,
              ]}
              onPress={() => setCountryPickerVisible(true)}
            >
              <Text
                style={
                  pickerCountryCode
                    ? styles.pickerInputText
                    : styles.pickerInputPlaceholder
                }
              >
                {pickerCountryCode
                  ? `${flagEmoji(pickerCountryCode)}  ${countryName(pickerCountryCode)}`
                  : 'Select a country'}
              </Text>
            </Pressable>
            {/* No minimumDate: see the matching comment in SettingsScreen.tsx.
              The range is enforced on Save instead (handleSaveTrip). */}
            <View style={Platform.OS === 'ios' ? styles.spinnerBox : undefined}>
              <DateTimePicker
                // Follows the OS appearance by default, not the app's -- so a
                // user on System=dark with the app forced Light would get a
                // dark picker on a light sheet.
                themeVariant={t.name}
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
              onPress={handleSaveTrip}
            >
              <Text style={styles.pickerSaveText}>Save</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.pickerClose,
                pressed && styles.pressed,
              ]}
              onPress={() => setEditingTrip(false)}
            >
              <Text style={styles.pickerCloseText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          // An upcoming trip shows as the Timeline's HeroCard (same component,
          // so the two can't drift). No trip, or one already past, shows the
          // plain prompt -- HeroCard would fall back to the anniversary there,
          // which Home already states in the line above.
          <Pressable
            style={({ pressed }) => pressed && styles.pressed}
            onPress={startEditingTrip}
            accessibilityRole="button"
            accessibilityHint="Edits your next trip"
          >
            {trip === undefined ? (
              <View style={styles.tripPlaceholder} />
            ) : tripUpcoming ? (
              <HeroCard />
            ) : (
              <View style={styles.entryCard}>
                <Text style={styles.entryCardLabel}>Plan your next visit</Text>
              </View>
            )}
          </Pressable>
        )}
        {/* Above the record CTA on purpose: the pet's state is the reason to
          tap it, so it should be read first. */}
        {mood && (
          <View style={styles.petCard}>
            <SharedPet mood={mood} size={72} resting={petResting} />
            <View style={styles.petCopy}>
              <Text style={styles.petTitle}>
                {petResting ? 'Resting' : PET_COPY[mood].title}
              </Text>
              <Text style={styles.petBody}>
                {petResting ? "Paused while you're away." : PET_COPY[mood].body}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
      {/* The daily clip IS the daily question's answer now -- RecordScreen
          shows the question, records the (video) answer, and reveals both
          partners' answers once submitted. See "Video daily question" in
          CLAUDE.md; replaces the old separate text-answer + generic-clip
          entry points. */}
      <Pressable
        style={styles.recordCtaPinned}
        onPress={() => navigation.navigate('Record')}
        onPressIn={handleRecordCtaPressIn}
        onPressOut={handleRecordCtaPressOut}
      >
        <Animated.View style={[styles.recordCta, recordCtaAnimatedStyle]}>
          <Text style={styles.recordCtaLabel}>Today's question</Text>
          {answeredToday === false && <View style={styles.unwatchedDot} />}
        </Animated.View>
      </Pressable>
      <Modal
        visible={countryPickerVisible}
        animationType="slide"
        onRequestClose={() => setCountryPickerVisible(false)}
      >
        <View style={[styles.countryModal, { paddingTop: insets.top + 20 }]}>
          <TextInput
            style={styles.pickerInput}
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
                <Text style={styles.countryRowText}>
                  {flagEmoji(item.code)} {item.name}
                </Text>
              </Pressable>
            )}
          />
          <Pressable
            style={({ pressed }) => [
              styles.pickerClose,
              pressed && styles.pressed,
            ]}
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

// makeStyles rather than a module-level StyleSheet.create: the object
// has to be rebuilt when the theme changes.
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
      padding: 20,
      // The pinned CTA sets its own gap to the tab bar.
      paddingBottom: 0,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: t.textPrimary,
      marginBottom: 8,
    },
    anniversaryText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textMuted,
      marginBottom: 16,
    },
    petCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: t.surface,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
    },
    petCopy: { flex: 1 },
    petTitle: {
      fontFamily: fonts.display,
      fontSize: fontSizes.md,
      color: t.textPrimary,
    },
    petBody: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: t.textMuted,
      marginTop: 2,
    },
    entryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 14,
      paddingHorizontal: 18,
      marginBottom: 16,
    },
    entryCardLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.textPrimary,
    },
    recordCta: {
      // Solid, not a gradient. The gradient ran to the day-orange, which
      // dissolves into the light ground (1.44:1) so the button lost its edge --
      // and could not carry white. A solid `accent` also flips with the theme,
      // so the thing you're meant to tap always stands off the page: deep blue
      // on the day-lit theme, day-orange on the night one.
      backgroundColor: t.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 18,
      overflow: 'hidden',
    },
    // Pinned above the tab bar, 18pt clear of it like Monthly Summary's
    // action row.
    recordCtaPinned: {
      marginTop: 12,
      marginBottom: 18,
    },
    body: {
      flex: 1,
    },
    // HeroCard's footprint (120 + its 20 margin), held while the trip query
    // is still loading so the pet card doesn't jump when it resolves.
    tripPlaceholder: {
      height: 140,
    },
    recordCtaLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.textOnAccent,
    },
    tripCardTitle: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.sm,
      color: t.textMuted,
      marginTop: 4,
    },
    // White, not t.danger: this dot sits on the record CTA's blue-to-orange
    // gradient, and salmon on the amber end was effectively invisible, so the
    // "you haven't answered today" signal was lost. White reads against both
    // ends. (TimelineScreen's same-named dot is on a pale card and stays red.)
    unwatchedDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.surface,
    },
    pressed: {
      opacity: 0.7,
    },
    editCard: {
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 18,
      marginBottom: 16,
    },
    pickerLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.textPrimary,
      marginBottom: 8,
    },
    pickerInput: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      color: t.textPrimary,
      marginBottom: 12,
    },
    pickerInputText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      color: t.textPrimary,
    },
    pickerInputPlaceholder: {
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
    pickerSave: {
      backgroundColor: t.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
    },
    pickerSaveText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.md,
      color: t.surface,
    },
    pickerClose: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    pickerCloseText: {
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
    countryRowText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      color: t.textPrimary,
    },
  });
