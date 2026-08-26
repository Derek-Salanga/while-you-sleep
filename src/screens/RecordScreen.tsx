import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
// expo-file-system's default export moved to a new File/Directory-based
// API in the SDK 54 version bump; the legacy import keeps getInfoAsync /
// readAsStringAsync working without a full rewrite.
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { usePairing } from '@/lib/PairingContext';
import { todayDateString } from '@/lib/date';
import { colors } from '@/theme/colors';
import { fonts, fontSizes } from '@/theme/typography';

const MAX_DURATION_SECONDS = 60;

export default function RecordScreen({ navigation }: any) {
  const { session, pair } = usePairing();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const insets = useSafeAreaInsets();

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.closeButton,
            { top: insets.top + 12 },
            pressed && styles.pressed,
          ]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
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

  async function handleStartRecording() {
    if (!cameraRef.current) return;
    setIsRecording(true);
    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_DURATION_SECONDS,
      });
      if (video?.uri) {
        await handleUpload(video.uri);
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

  async function handleUpload(localUri: string) {
    if (!session?.user || !pair) return;
    setUploading(true);
    try {
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (!fileInfo.exists) throw new Error('Recorded file not found.');

      const fileExt = localUri.split('.').pop() ?? 'mov';
      const dateStr = todayDateString();
      const storagePath = `${pair.id}/${session.user.id}/${dateStr}.${fileExt}`;

      const fileData = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { error: uploadError } = await supabase.storage
        .from('clips')
        .upload(storagePath, Buffer.from(fileData, 'base64'), {
          contentType: `video/${fileExt}`,
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('clips').upsert(
        {
          pair_id: pair.id,
          sender_id: session.user.id,
          storage_path: storagePath,
          recorded_for_date: dateStr,
        },
        { onConflict: 'pair_id,sender_id,recorded_for_date' }
      );
      if (insertError) throw insertError;

      Alert.alert('Clip sent', 'Your clip is on its way.', [
        // goBack() rather than navigate('Timeline') — Record was reached
        // by navigating forward from Timeline, so this returns to that
        // same screen instance (which reloads clips on focus) instead of
        // pushing a redundant new one onto the stack.
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="video"
      />
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
      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [
            styles.flipButton,
            pressed && styles.pressed,
          ]}
          onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
          disabled={isRecording || uploading}
        >
          <Text style={styles.flipButtonText}>Flip</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.recordButton,
            isRecording && styles.recordButtonActive,
            pressed && styles.pressed,
          ]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          disabled={uploading}
        />

        <View style={styles.flipButton} />
      </View>
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <Text style={styles.uploadingText}>Uploading your clip…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
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
  },
  closeButtonText: {
    color: colors.surface,
    fontSize: fontSizes.md,
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
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.surface,
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
    backgroundColor: colors.error,
    borderWidth: 4,
    borderColor: colors.surface,
  },
  recordButtonActive: {
    borderRadius: 12,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(46,42,61,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.surface,
    fontSize: fontSizes.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
