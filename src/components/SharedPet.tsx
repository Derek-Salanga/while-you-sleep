import React from 'react';
import {
  AccessibilityInfo,
  AppState,
  Image,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { PetMood } from '@/types';

// Hand-drawn layers on one shared square canvas: each is absolute-fill and
// must never be cropped or positioned on its own, or the cat falls apart.
// Metro picks the @1x/@2x/@3x file (260/520/780px) for the screen.
const BODY = require('../../assets/cat/runtime/cat-body.png');
const HEAD = require('../../assets/cat/runtime/cat-head.png');
const EYES_OPEN = require('../../assets/cat/runtime/cat-eyes-open.png');
const EYES_CLOSED = require('../../assets/cat/runtime/cat-eyes-closed.png');
const TAIL = require('../../assets/cat/runtime/cat-tail.png');
const LEFT_EAR = require('../../assets/cat/runtime/cat-ear-left.png');
const RIGHT_EAR = require('../../assets/cat/runtime/cat-ear-right.png');

// Mood only scales how much the cat moves; the face is one neutral drawing
// until per-mood faces are drawn.
const MOTION: Record<PetMood, number> = {
  thriving: 1,
  content: 0.72,
  sleepy: 0.38,
  withdrawn: 0.18,
};

// A duration somewhere in [min, max], so no loop repeats at a fixed beat.
const rand = (min: number, max: number) => min + Math.random() * (max - min);

const EASE = Easing.inOut(Easing.sin);

// Live, unlike Reanimated's useReducedMotion(), which reads the setting
// once at launch -- turning Reduce Motion on mid-session must still the cat.
function useReduceMotion() {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setOn);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setOn
    );
    return () => sub.remove();
  }, []);
  return on;
}

// Backgrounded, the JS timers would keep scheduling motion nobody sees.
function useAppActive() {
  const [on, setOn] = React.useState(AppState.currentState === 'active');
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (s) =>
      setOn(s === 'active')
    );
    return () => sub.remove();
  }, []);
  return on;
}

interface SharedPetProps {
  mood: PetMood;
  size?: number;
  resting?: boolean;
  // False stops every animation and timer -- Home passes its focus state,
  // since a pushed screen (the trip editor) leaves it mounted underneath.
  active?: boolean;
}

export default function SharedPet({
  mood,
  size = 120,
  resting = false,
  active = true,
}: SharedPetProps) {
  const reduceMotion = useReduceMotion();
  const appActive = useAppActive();
  const breath = useSharedValue(1);
  const tailRotation = useSharedValue(0);
  const leftEarRotation = useSharedValue(0);
  const rightEarRotation = useSharedValue(0);
  // 0 open, 1 closed. Both eye images stay mounted and cross by opacity:
  // swapping an Image's source reloads it asynchronously on iOS, which
  // flashed an eyeless frame on every blink.
  const eyesClosed = useSharedValue(resting ? 1 : 0);

  React.useEffect(() => {
    const values = [breath, tailRotation, leftEarRotation, rightEarRotation];
    values.forEach(cancelAnimation);
    // Ease back to rest rather than snapping: a mood change mid-swish would
    // otherwise jump the tail in one frame.
    const settle = { duration: 250, easing: EASE };
    breath.set(withTiming(1, settle));
    tailRotation.set(withTiming(0, settle));
    leftEarRotation.set(withTiming(0, settle));
    rightEarRotation.set(withTiming(0, settle));
    eyesClosed.set(resting ? 1 : 0);

    if (reduceMotion || !active || !appActive) return;

    const intensity = resting ? 0.12 : MOTION[mood];
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(() => alive && fn(), ms));
    };

    // Each behaviour is scheduled one cycle at a time rather than with
    // withRepeat, so every cycle gets its own length and depth -- a fixed
    // loop reads as mechanical within a few seconds.
    const breathe = () => {
      const inhale = rand(1600, 2300);
      const exhale = inhale * rand(1.0, 1.25);
      breath.set(
        withSequence(
          withTiming(1 + rand(0.009, 0.014) * intensity, {
            duration: inhale,
            easing: EASE,
          }),
          withTiming(1, { duration: exhale, easing: EASE })
        )
      );
      later(breathe, inhale + exhale);
    };
    breathe();

    // Resting: slow breathing only, eyes shut.
    if (!resting) {
      // Tail swishes in short bouts, with a random rest between them that
      // runs longer in a calmer mood.
      const swish = () => {
        const degrees = rand(3.5, 6) * intensity;
        const out = rand(1100, 1700);
        const back = rand(2200, 3200);
        const settleMs = rand(1100, 1700);
        tailRotation.set(
          withSequence(
            withTiming(-degrees, { duration: out, easing: EASE }),
            withTiming(degrees, { duration: back, easing: EASE }),
            withTiming(0, { duration: settleMs, easing: EASE })
          )
        );
        const rest = rand(600, 4000) / Math.max(intensity, 0.3);
        later(swish, out + back + settleMs + rest);
      };
      swish();

      const blink = () => {
        eyesClosed.set(1);
        later(() => {
          eyesClosed.set(0);
          later(blink, rand(2800, 7000));
        }, 160);
      };
      later(blink, rand(2800, 7000));

      const twitch = (ear: SharedValue<number>, direction: number) => {
        const degrees = direction * 4 * intensity;
        ear.set(
          withSequence(
            withTiming(degrees, { duration: 110 }),
            withTiming(-degrees * 0.35, { duration: 120 }),
            withTiming(0, { duration: 150 })
          )
        );
        later(() => twitch(ear, direction), rand(4200, 9400));
      };
      later(() => twitch(leftEarRotation, -1), rand(4200, 9400));
      later(() => twitch(rightEarRotation, 1), rand(4200, 9400));
    }

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      values.forEach(cancelAnimation);
    };
  }, [
    active,
    appActive,
    breath,
    eyesClosed,
    leftEarRotation,
    mood,
    reduceMotion,
    resting,
    rightEarRotation,
    tailRotation,
  ]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: breath.get() }],
  }));
  const tailStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tailRotation.get()}deg` }],
  }));
  const leftEarStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${leftEarRotation.get()}deg` }],
  }));
  const rightEarStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rightEarRotation.get()}deg` }],
  }));
  const eyesOpenStyle = useAnimatedStyle(() => ({
    opacity: 1 - eyesClosed.get(),
  }));
  const eyesClosedStyle = useAnimatedStyle(() => ({
    opacity: eyesClosed.get(),
  }));
  const pivots = React.useMemo(
    () => ({
      // From the paws, so the cat rises rather than stretching both ways.
      breath: { transformOrigin: [size * 0.5, size * 0.9, 0] },
      tail: { transformOrigin: [size * 0.749, size * 0.7969, 0] },
      leftEar: { transformOrigin: [size * 0.3779, size * 0.2666, 0] },
      rightEar: { transformOrigin: [size * 0.627, size * 0.2461, 0] },
    }),
    [size]
  );
  const label = resting ? 'Shared cat, resting' : `Shared cat, ${mood}`;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.layer, pivots.tail, tailStyle]}>
        <Image source={TAIL} style={styles.layer} resizeMode="contain" />
      </Animated.View>
      {/* Everything but the tail breathes together, so the head rises with
          the body instead of the neck seam sliding under a still head. */}
      <Animated.View style={[styles.layer, pivots.breath, breathStyle]}>
        <Image source={BODY} style={styles.layer} resizeMode="contain" />
        <Animated.View style={[styles.layer, pivots.leftEar, leftEarStyle]}>
          <Image source={LEFT_EAR} style={styles.layer} resizeMode="contain" />
        </Animated.View>
        <Animated.View style={[styles.layer, pivots.rightEar, rightEarStyle]}>
          <Image source={RIGHT_EAR} style={styles.layer} resizeMode="contain" />
        </Animated.View>
        <Image source={HEAD} style={styles.layer} resizeMode="contain" />
        <Animated.Image
          source={EYES_OPEN}
          style={[styles.layer, eyesOpenStyle]}
          resizeMode="contain"
          fadeDuration={0}
        />
        <Animated.Image
          source={EYES_CLOSED}
          style={[styles.layer, eyesClosedStyle]}
          resizeMode="contain"
          fadeDuration={0}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});
