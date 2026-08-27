import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { todayDateString } from '@/lib/date';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

export default function HomeScreen({ navigation }: any) {
  const { session, pair } = usePairing();
  const insets = useSafeAreaInsets();
  const [answeredToday, setAnsweredToday] = useState(false);

  const loadQuestionStatus = useCallback(async () => {
    if (!pair || !session?.user) return;
    const { data, error } = await supabase
      .from('daily_answers')
      .select('id')
      .eq('pair_id', pair.id)
      .eq('user_id', session.user.id)
      .eq('answered_for_date', todayDateString())
      .maybeSingle();

    if (error) {
      console.error('Failed to load question status:', error.message);
      return;
    }
    setAnsweredToday(!!data);
  }, [pair, session]);

  useFocusEffect(
    useCallback(() => {
      loadQuestionStatus();
    }, [loadQuestionStatus])
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>Home</Text>
      <Pressable
        style={({ pressed }) => [styles.entryCard, pressed && styles.pressed]}
        onPress={() => navigation.navigate('DailyQuestion')}
      >
        <Text style={styles.entryCardLabel}>Today's question</Text>
        {!answeredToday && <View style={styles.unwatchedDot} />}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.recordFab, pressed && styles.pressed]}
        onPress={() => navigation.navigate('Record')}
      >
        <Text style={styles.recordFabText}>Record today's clip</Text>
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
  unwatchedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  recordFab: {
    marginTop: 'auto',
    marginBottom: 24,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  recordFabText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.surface,
    fontSize: fontSizes.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
