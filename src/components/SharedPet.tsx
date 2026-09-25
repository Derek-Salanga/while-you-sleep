import React from 'react';
import {
  AccessibilityInfo,
  AppState,
  Image,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
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
const LAYERS = [BODY, HEAD, EYES_OPEN, EYES_CLOSED, TAIL, LEFT_EAR, RIGHT_EAR];
const LAYER_COUNT = LAYERS.length;

// Warm the image cache at app launch (this module is imported with the
// navigator), so by the time Home mounts the layers are already fetched and
// decode together. In development they're served over Metro -- through a
// tunnel that's slow enough that they arrived one by one.
LAYERS.forEach((src) => {
  const uri = Image.resolveAssetSource(src)?.uri;
  if (uri) Image.prefetch(uri).catch(() => {});
});

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
  // Called once every layer is ready, so the caller can reveal anything
  // that belongs with the cat (Home's mood title) at the same moment.
  onReady?: () => void;
}

export default function SharedPet({
  mood,
  size = 120,
  resting = false,
  active = true,
  onReady,
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
  const hop = useSharedValue(0);
  // All seven layers decode separately, so without this they pop in one by
  // one on every Home visit. Hidden until every layer reports in (or a
  // short fallback passes, so a failed load can't hide the cat for good).
  const [loaded, setLoaded] = React.useState(0);
  const [timedOut, setTimedOut] = React.useState(false);
  React.useEffect(() => {
    // Generous: it only exists so a failed load can't hide the cat forever,
    // and at 800ms it fired before slow dev loads finished.
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);
  const onLayerLoad = React.useCallback(() => setLoaded((n) => n + 1), []);
  const visible = loaded >= LAYER_COUNT || timedOut;
  React.useEffect(() => {
    if (visible) onReady?.();
  }, [visible, onReady]);
  const lastTap = React.useRef(0);

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
      // The tail alternates between a slow sway and, now and then, a quick
      // wag of a few beats -- likelier the happier the mood. Both go through
      // this one scheduler so they never fight over the tail.
      const swish = () => {
        if (Math.random() < 0.4 * intensity) {
          const beats = Math.round(rand(3, 5));
          const degrees = rand(9, 13) * Math.max(intensity, 0.4);
          const beat = rand(130, 170);
          const steps = [];
          for (let i = 0; i < beats; i++) {
            steps.push(
              withTiming(i % 2 ? degrees : -degrees, {
                duration: beat,
                easing: EASE,
              })
            );
          }
          steps.push(withTiming(0, { duration: beat * 1.5, easing: EASE }));
          tailRotation.set(withSequence(...steps));
          const rest = rand(1500, 4500) / Math.max(intensity, 0.3);
          later(swish, beat * (beats + 1.5) + rest);
          return;
        }
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

  // Tapping the cat: a little hop, ears perk, a happy squint and a quick
  // wag. Throttled so hammering it doesn't stack animations. With Reduce
  // Motion on it only blinks; resting, it just stirs (a slow blink).
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 600) return;
    lastTap.current = now;
    eyesClosed.set(
      withSequence(
        withTiming(1, { duration: 60 }),
        withTiming(1, { duration: resting ? 500 : 220 }),
        withTiming(resting ? 1 : 0, { duration: 80 })
      )
    );
    if (reduceMotion || resting) return;
    const lift = size * 0.05 * Math.max(MOTION[mood], 0.4);
    hop.set(
      withSequence(
        withTiming(-lift, { duration: 140, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 9, stiffness: 180 })
      )
    );
    const perk = 9;
    leftEarRotation.set(
      withSequence(
        withTiming(-perk, { duration: 120 }),
        withTiming(0, { duration: 320, easing: EASE })
      )
    );
    rightEarRotation.set(
      withSequence(
        withTiming(perk, { duration: 120 }),
        withTiming(0, { duration: 320, easing: EASE })
      )
    );
    tailRotation.set(
      withSequence(
        withTiming(-12, { duration: 120 }),
        withTiming(12, { duration: 140 }),
        withTiming(-8, { duration: 140 }),
        withTiming(0, { duration: 200, easing: EASE })
      )
    );
  };

  const hopStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.get() }],
  }));
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
    <Pressable
      onPress={handleTap}
      style={{ width: size, height: size, opacity: visible ? 1 : 0 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Say hi to your cat"
    >
      <Animated.View style={[styles.layer, hopStyle]}>
        <Animated.View style={[styles.layer, pivots.tail, tailStyle]}>
          <Image
            source={TAIL}
            onLoad={onLayerLoad}
            onError={onLayerLoad}
            style={styles.layer}
            resizeMode="contain"
          />
        </Animated.View>
        {/* Everything but the tail breathes together, so the head rises with
          the body instead of the neck seam sliding under a still head. */}
        <Animated.View style={[styles.layer, pivots.breath, breathStyle]}>
          <Image
            source={BODY}
            onLoad={onLayerLoad}
            onError={onLayerLoad}
            style={styles.layer}
            resizeMode="contain"
          />
          <Animated.View style={[styles.layer, pivots.leftEar, leftEarStyle]}>
            <Image
              source={LEFT_EAR}
              onLoad={onLayerLoad}
              onError={onLayerLoad}
              style={styles.layer}
              resizeMode="contain"
            />
          </Animated.View>
          <Animated.View style={[styles.layer, pivots.rightEar, rightEarStyle]}>
            <Image
              source={RIGHT_EAR}
              onLoad={onLayerLoad}
              onError={onLayerLoad}
              style={styles.layer}
              resizeMode="contain"
            />
          </Animated.View>
          <Image
            source={HEAD}
            onLoad={onLayerLoad}
            onError={onLayerLoad}
            style={styles.layer}
            resizeMode="contain"
          />
          <Animated.Image
            source={EYES_OPEN}
            onLoad={onLayerLoad}
            onError={onLayerLoad}
            style={[styles.layer, eyesOpenStyle]}
            resizeMode="contain"
            fadeDuration={0}
          />
          <Animated.Image
            source={EYES_CLOSED}
            onLoad={onLayerLoad}
            onError={onLayerLoad}
            style={[styles.layer, eyesClosedStyle]}
            resizeMode="contain"
            fadeDuration={0}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});
