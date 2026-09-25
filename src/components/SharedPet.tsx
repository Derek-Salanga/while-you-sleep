import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { PetMood } from '@/types';

const BODY = require('../../assets/cat/runtime/cat-body.png');
const HEAD = require('../../assets/cat/runtime/cat-head.png');
const EYES_OPEN = require('../../assets/cat/runtime/cat-eyes-open.png');
const EYES_CLOSED = require('../../assets/cat/runtime/cat-eyes-closed.png');
const TAIL = require('../../assets/cat/runtime/cat-tail.png');
const LEFT_EAR = require('../../assets/cat/runtime/cat-ear-left.png');
const RIGHT_EAR = require('../../assets/cat/runtime/cat-ear-right.png');

const MOTION: Record<PetMood, number> = {
  thriving: 1,
  content: 0.72,
  sleepy: 0.38,
  withdrawn: 0.18,
};

// A duration somewhere in [min, max], so no loop repeats at a fixed beat.
const rand = (min: number, max: number) => min + Math.random() * (max - min);

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
  const reduceMotion = useReducedMotion();
  const [eyesClosed, setEyesClosed] = React.useState(resting);
  const bodyScale = useSharedValue(1);
  const tailRotation = useSharedValue(0);
  const leftEarRotation = useSharedValue(0);
  const rightEarRotation = useSharedValue(0);

  React.useEffect(() => {
    const animatedValues = [
      bodyScale,
      tailRotation,
      leftEarRotation,
      rightEarRotation,
    ];
    animatedValues.forEach(cancelAnimation);

    bodyScale.set(1);
    setEyesClosed(resting);
    tailRotation.set(0);
    leftEarRotation.set(0);
    rightEarRotation.set(0);

    if (reduceMotion || !active) return;

    const intensity = resting ? 0.12 : MOTION[mood];
    let alive = true;
    let breathTimer: ReturnType<typeof setTimeout>;
    let tailTimer: ReturnType<typeof setTimeout>;

    // Breathing is scheduled one cycle at a time rather than with
    // withRepeat, so every in/out gets its own length and depth -- a fixed
    // loop reads as mechanical within a few seconds.
    const breathe = () => {
      if (!alive) return;
      const inhale = rand(1600, 2300);
      const exhale = inhale * rand(1.0, 1.25);
      bodyScale.set(
        withSequence(
          withTiming(1 + rand(0.009, 0.014) * intensity, {
            duration: inhale,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(1, {
            duration: exhale,
            easing: Easing.inOut(Easing.sin),
          })
        )
      );
      breathTimer = setTimeout(breathe, inhale + exhale);
    };
    breathe();

    if (resting) {
      return () => {
        alive = false;
        clearTimeout(breathTimer);
        animatedValues.forEach(cancelAnimation);
      };
    }

    // The tail swishes in short bouts with a random rest between them; a
    // calmer mood rests longer.
    const swish = () => {
      if (!alive) return;
      const degrees = rand(3.5, 6) * intensity;
      const out = rand(1100, 1700);
      const back = rand(2200, 3200);
      const settle = rand(1100, 1700);
      tailRotation.set(
        withSequence(
          withTiming(-degrees, {
            duration: out,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(degrees, {
            duration: back,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: settle,
            easing: Easing.inOut(Easing.sin),
          })
        )
      );
      const rest = rand(600, 4000) / Math.max(intensity, 0.3);
      tailTimer = setTimeout(swish, out + back + settle + rest);
    };
    swish();

    let blinkTimer: ReturnType<typeof setTimeout>;
    let openEyesTimer: ReturnType<typeof setTimeout>;
    let leftEarTimer: ReturnType<typeof setTimeout>;
    let rightEarTimer: ReturnType<typeof setTimeout>;

    const scheduleBlink = () => {
      blinkTimer = setTimeout(
        () => {
          if (!alive) return;
          setEyesClosed(true);
          openEyesTimer = setTimeout(() => {
            if (!alive) return;
            setEyesClosed(false);
            scheduleBlink();
          }, 160);
        },
        2800 + Math.random() * 4200
      );
    };

    const scheduleEarTwitch = (
      ear: SharedValue<number>,
      direction: number,
      setTimer: (timer: ReturnType<typeof setTimeout>) => void
    ) => {
      setTimer(
        setTimeout(
          () => {
            if (!alive) return;
            const degrees = direction * 4 * intensity;
            ear.set(
              withSequence(
                withTiming(degrees, { duration: 110 }),
                withTiming(-degrees * 0.35, { duration: 120 }),
                withTiming(0, { duration: 150 })
              )
            );
            scheduleEarTwitch(ear, direction, setTimer);
          },
          4200 + Math.random() * 5200
        )
      );
    };

    scheduleBlink();
    scheduleEarTwitch(leftEarRotation, -1, (timer) => {
      leftEarTimer = timer;
    });
    scheduleEarTwitch(rightEarRotation, 1, (timer) => {
      rightEarTimer = timer;
    });

    return () => {
      alive = false;
      clearTimeout(breathTimer);
      clearTimeout(tailTimer);
      clearTimeout(blinkTimer);
      clearTimeout(openEyesTimer);
      clearTimeout(leftEarTimer);
      clearTimeout(rightEarTimer);
      animatedValues.forEach(cancelAnimation);
    };
  }, [
    active,
    bodyScale,
    leftEarRotation,
    mood,
    reduceMotion,
    resting,
    rightEarRotation,
    tailRotation,
  ]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: bodyScale.get() }],
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
  const pivots = React.useMemo(
    () => ({
      body: { transformOrigin: [size * 0.5, size * 0.9, 0] },
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
      <Animated.View style={[styles.layer, pivots.body, bodyStyle]}>
        <Image source={BODY} style={styles.layer} resizeMode="contain" />
      </Animated.View>
      <Animated.View style={[styles.layer, pivots.leftEar, leftEarStyle]}>
        <Image source={LEFT_EAR} style={styles.layer} resizeMode="contain" />
      </Animated.View>
      <Animated.View style={[styles.layer, pivots.rightEar, rightEarStyle]}>
        <Image source={RIGHT_EAR} style={styles.layer} resizeMode="contain" />
      </Animated.View>
      <Image source={HEAD} style={styles.layer} resizeMode="contain" />
      <Image
        source={eyesClosed ? EYES_CLOSED : EYES_OPEN}
        style={styles.layer}
        resizeMode="contain"
        fadeDuration={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});
