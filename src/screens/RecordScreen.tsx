import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { useUploadClip } from '@/hooks/mutations';
import { sharedTodayDateString } from '@/lib/date';
import { getQuestionForDate } from '@/data/dailyQuestions';
import { Clip } from '@/types';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

// The daily clip IS the daily question's answer -- there's no separate
// text-answer flow anymore (see "Video daily question" in CLAUDE.md).
const MAX_DURATION_SECONDS = 30;
// Caps file size at capture time rather than compressing after the fact --
// react-native-compressor/ffmpeg-kit-style libraries ship native code that
// needs a custom EAS Dev Client build, not Expo Go (same constraint already
// noted for Monthly Summary's recap video). 720p + this bitrate caps a full
// 30s clip at roughly 9.4MB (2.5Mbps * 30s / 8) regardless of the source
// device's camera capabilities.
const VIDEO_BITRATE = 2_500_000; // 2.5 Mbps

type Phase = 'loading' | 'camera' | 'review' | 'revealed';

export default function RecordScreen({ navigation }: any) {
  const { session, pair } = usePairing();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [isRecording, setIsRecording] = useState(false);
  const insets = useSafeAreaInsets();
  const uploadClip = useUploadClip();
  const uploading = uploadClip.isPending;

  // Shared (UTC) boundary, not local — both partners must be on the same
  // question and stamp clips with the same date. See src/lib/date.ts.
  const today = sharedTodayDateString();
  const question = getQuestionForDate(today);

  const [phase, setPhase] = useState<Phase>('loading');
  const [myClip, setMyClip] = useState<Clip | null>(null);
  const [partnerClip, setPartnerClip] = useState<Clip | null>(null);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [secondsRemaining, setSecondsRemaining] =
    useState(MAX_DURATION_SECONDS);

  const recordButtonScale = useSharedValue(1);
  const recordButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordButtonScale.value }],
  }));
  const handleRecordPressIn = () => {
    recordButtonScale.value = withTiming(0.9, { duration: 100 });
  };
  const handleRecordPressOut = () => {
    recordButtonScale.value = withTiming(1, { duration: 100 });
  };

  // Purely a display countdown -- recordAsync's own maxDuration is what
  // actually stops the recording, this just mirrors it on screen.
  useEffect(() => {
    if (!isRecording) {
      setSecondsRemaining(MAX_DURATION_SECONDS);
      return;
    }
    const interval = setInterval(() => {
      setSecondsRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  const loadTodayClips = useCallback(async () => {
    if (!pair || !session?.user) return;
    const { data, error } = await supabase
      .from('clips')
      .select('*')
      .eq('pair_id', pair.id)
      .eq('recorded_for_date', today);

    if (error) {
      console.error("Failed to load today's clips:", error.message);
      setPhase('camera');
      return;
    }
    const rows = (data ?? []) as Clip[];
    const mine = rows.find((r) => r.sender_id === session.user.id) ?? null;
    const theirs = rows.find((r) => r.sender_id !== session.user.id) ?? null;
    setMyClip(mine);
    setPartnerClip(theirs);
    setPhase(mine ? 'revealed' : 'camera');
  }, [pair, session, today]);

  useEffect(() => {
    loadTodayClips();
  }, [loadTodayClips]);

  // No realtime subscription elsewhere in this app, so keep the pattern
  // consistent: poll while genuinely waiting on the partner, rather than
  // only refreshing on remount (which meant the reveal never happened
  // while this screen stayed open).
  useEffect(() => {
    if (!myClip || partnerClip) return;
    const interval = setInterval(loadTodayClips, 15_000);
    return () => clearInterval(interval);
  }, [myClip, partnerClip, loadTodayClips]);

  async function handleStartRecording() {
    if (!cameraRef.current) return;
    setIsRecording(true);
    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_DURATION_SECONDS,
        // HEVC roughly halves file size vs. H.264 at the same visual
        // quality; iOS-only option (every iPhone since the 7 supports it).
        // No Android equivalent in expo-camera's recordAsync -- videoQuality
        // + videoBitrate on CameraView below still cap it there.
        ...(Platform.OS === 'ios' ? { codec: 'hvc1' as const } : {}),
      });
      if (video?.uri) {
        setPendingUri(video.uri);
        setPhase('review');
      }
    } catch (err: any) {
      Alert.alert('Recording failed', err.message);
    } finally {
      setIsRecording(false);
    }
  }

  function handleStopRecording() {
    cameraRef.current?.stopRecording();
  }

  function handleRetake() {
    setPendingUri(null);
    setCaptionDraft('');
    setPhase('camera');
  }

  async function handleSend() {
    if (!session?.user || !pair || !pendingUri) return;
    try {
      const clip = await uploadClip.mutateAsync({
        pairId: pair.id,
        senderId: session.user.id,
        uri: pendingUri,
        date: today,
        caption: captionDraft,
      });
      setMyClip(clip);
      setPendingUri(null);
      setCaptionDraft('');
      setPhase('revealed');
    } catch (err: any) {
      Alert.alert('Upload failed', err.message);
    }
  }

  const closeButton = (
    <Pressable
      style={({ pressed }) => [
        styles.closeButton,
        { top: insets.top + 12 },
        pressed && styles.pressed,
      ]}
      onPress={() => navigation.goBack()}
      disabled={uploading}
    >
      <Text style={styles.closeButtonText}>✕</Text>
    </Pressable>
  );

  if (phase === 'loading') {
    return (
      <View style={styles.container}>
        {closeButton}
        <View style={styles.centered}>
          <ActivityIndicator color={colors.surface} size="large" />
        </View>
      </View>
    );
  }

  if (phase === 'revealed') {
    return (
      <View style={[styles.revealContainer, { paddingTop: insets.top + 20 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.textCloseButton,
            pressed && styles.pressed,
          ]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.textCloseButtonText}>✕ Close</Text>
        </Pressable>
        <Text style={styles.title}>Today's question</Text>
        <Text style={styles.question}>{question}</Text>

        <View style={styles.answersContainer}>
          <View style={[styles.answerCard, styles.answerCardMine]}>
            <Text style={styles.answerLabel}>You</Text>
            {myClip?.caption_text && (
              <Text style={styles.answerCaption}>{myClip.caption_text}</Text>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.watchButton,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                navigation.navigate('ClipView', { clipId: myClip!.id })
              }
            >
              <Text style={styles.watchButtonText}>Watch your clip</Text>
            </Pressable>
          </View>

          {partnerClip ? (
            <View style={[styles.answerCard, styles.answerCardPartner]}>
              <Text style={styles.answerLabel}>Your partner</Text>
              {partnerClip.caption_text && (
                <Text style={styles.answerCaption}>
                  {partnerClip.caption_text}
                </Text>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.watchButton,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  navigation.navigate('ClipView', { clipId: partnerClip.id })
                }
              >
                <Text style={styles.watchButtonText}>Watch their clip</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.waiting}>
              Waiting for your partner to answer…
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        {closeButton}
        <Text style={styles.permissionText}>
          While You Sleep needs camera access to record your daily clip.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Grant permission</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'review') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top + 20 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {closeButton}
        <Text style={styles.reviewTitle}>Add a caption?</Text>
        <Text style={styles.reviewSubtitle}>
          Optional -- goes alongside your clip.
        </Text>
        <TextInput
          style={styles.captionInput}
          placeholder="Say a bit more…"
          placeholderTextColor={colors.muted}
          multiline
          value={captionDraft}
          onChangeText={setCaptionDraft}
          editable={!uploading}
        />
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={handleSend}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.buttonText}>Send</Text>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.retakeButton,
            pressed && styles.pressed,
          ]}
          onPress={handleRetake}
          disabled={uploading}
        >
          <Text style={styles.retakeButtonText}>Retake</Text>
        </Pressable>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="video"
        videoQuality="720p"
        videoBitrate={VIDEO_BITRATE}
      />
      {closeButton}
      <View style={[styles.questionBanner, { top: insets.top + 12 }]}>
        <Text style={styles.questionBannerText}>{question}</Text>
      </View>
      {isRecording && (
        <View style={styles.timerPill}>
          <Text style={styles.timerText}>{secondsRemaining}s</Text>
        </View>
      )}
      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [
            styles.flipButton,
            pressed && styles.pressed,
          ]}
          onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
          disabled={isRecording}
        >
          <Text style={styles.flipButtonText}>Flip</Text>
        </Pressable>

        <Pressable
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          onPressIn={handleRecordPressIn}
          onPressOut={handleRecordPressOut}
        >
          <Animated.View
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive,
              recordButtonAnimatedStyle,
            ]}
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Pressable>

        <View style={styles.flipButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  camera: { flex: 1 },
  closeButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    color: colors.surface,
    fontSize: fontSizes.md,
    fontFamily: fonts.bodySemiBold,
  },
  questionBanner: {
    position: 'absolute',
    left: 64,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  questionBannerText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontFamily: fonts.bodySemiBold,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionText: {
    fontFamily: fonts.body,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.surface,
    fontSize: fontSizes.md,
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  flipButton: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipButtonText: {
    fontFamily: fonts.bodyMedium,
    color: colors.surface,
    fontSize: fontSizes.sm,
  },
  recordButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: colors.surface,
  },
  recordButtonActive: {
    borderRadius: 12,
  },
  timerPill: {
    position: 'absolute',
    bottom: 132,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  timerText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.surface,
  },
  pressed: {
    opacity: 0.7,
  },
  reviewTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.surface,
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  reviewSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  captionInput: {
    marginHorizontal: 24,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.ink,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  retakeButton: {
    marginHorizontal: 24,
    alignItems: 'center',
    paddingVertical: 12,
  },
  retakeButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.surface,
  },
  revealContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  textCloseButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  textCloseButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.muted,
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
  answerCaption: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.ink,
    marginBottom: 12,
  },
  watchButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  watchButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
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
