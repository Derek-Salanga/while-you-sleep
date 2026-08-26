import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { todayDateString } from '@/lib/date';
import { getQuestionForDate } from '@/data/dailyQuestions';
import { DailyAnswer } from '@/types';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

export default function DailyQuestionScreen() {
  const { session, pair } = usePairing();
  const insets = useSafeAreaInsets();
  const today = todayDateString();
  const question = getQuestionForDate(today);

  const [loading, setLoading] = useState(true);
  const [myAnswer, setMyAnswer] = useState<DailyAnswer | null>(null);
  const [partnerAnswer, setPartnerAnswer] = useState<DailyAnswer | null>(null);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAnswers = useCallback(async () => {
    if (!pair || !session?.user) return;
    const { data, error } = await supabase
      .from('daily_answers')
      .select('*')
      .eq('pair_id', pair.id)
      .eq('answered_for_date', today);

    if (error) {
      console.error('Failed to load daily answers:', error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as DailyAnswer[];
    setMyAnswer(rows.find((r) => r.user_id === session.user.id) ?? null);
    setPartnerAnswer(rows.find((r) => r.user_id !== session.user.id) ?? null);
    setLoading(false);
  }, [pair, session, today]);

  useEffect(() => {
    loadAnswers();
  }, [loadAnswers]);

  async function handleSubmit() {
    if (!session?.user || !pair || !draft.trim()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('daily_answers')
        .insert({
          pair_id: pair.id,
          user_id: session.user.id,
          answered_for_date: today,
          answer_text: draft.trim(),
        })
        .select()
        .single();
      if (error) throw error;
      setMyAnswer(data as DailyAnswer);
    } catch (err: any) {
      Alert.alert('Could not submit answer', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 20 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Today's question</Text>
      <Text style={styles.question}>{question}</Text>

      {!myAnswer ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Write your answer…"
            placeholderTextColor={colors.muted}
            multiline
            value={draft}
            onChangeText={setDraft}
          />
          <Pressable
            style={({ pressed }) => [
              styles.button,
              !draft.trim() && styles.buttonDisabled,
              pressed && styles.pressed,
            ]}
            onPress={handleSubmit}
            disabled={submitting || !draft.trim()}
          >
            {submitting ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.buttonText}>Submit answer</Text>
            )}
          </Pressable>
        </>
      ) : (
        <View style={styles.answersContainer}>
          <View style={[styles.answerCard, styles.answerCardMine]}>
            <Text style={styles.answerLabel}>You</Text>
            <Text style={styles.answerText}>{myAnswer.answer_text}</Text>
          </View>

          {partnerAnswer ? (
            <View style={[styles.answerCard, styles.answerCardPartner]}>
              <Text style={styles.answerLabel}>Your partner</Text>
              <Text style={styles.answerText}>{partnerAnswer.answer_text}</Text>
            </View>
          ) : (
            <Text style={styles.waiting}>
              Waiting for your partner to answer…
            </Text>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.ink,
    marginBottom: 12,
  },
  question: {
    fontFamily: fonts.displayItalic,
    fontSize: fontSizes.lg,
    color: colors.ink,
    marginBottom: 24,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.ink,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.surface,
    fontSize: fontSizes.md,
  },
  pressed: {
    opacity: 0.7,
  },
  answersContainer: {
    gap: 16,
  },
  answerCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },
  answerCardMine: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.primaryLight,
  },
  answerCardPartner: {
    backgroundColor: colors.secondaryTint,
    borderColor: colors.secondaryLight,
  },
  answerLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.ink,
    marginBottom: 6,
  },
  answerText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.ink,
  },
  waiting: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },
});
