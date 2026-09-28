import React from 'react';
import {
  AccessibilityInfo,
  AppState,
  Image,
  PixelRatio,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
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

import type { PetMood, PetSpecies } from '@/types';

// Hand-drawn layers share one square canvas and normally stay absolute-fill.
// The dog tail alone clips its concealed root before rotation; head, ears and
// eyes also move together by `headDrop` (see the geometry below).
// Metro picks the @1x/@2x/@3x file (260/520/780px) for the screen.
const CAT_LAYERS = {
  tail: require('../../assets/cat/runtime/cat-tail.png'),
  body: require('../../assets/cat/runtime/cat-body.png'),
  leftEar: require('../../assets/cat/runtime/cat-ear-left.png'),
  rightEar: require('../../assets/cat/runtime/cat-ear-right.png'),
  head: require('../../assets/cat/runtime/cat-head.png'),
  eyesOpen: require('../../assets/cat/runtime/cat-eyes-open.png'),
  eyesClosed: require('../../assets/cat/runtime/cat-eyes-closed.png'),
};
type LayerName = keyof typeof CAT_LAYERS;
type LayerSet = Record<LayerName, ImageSourcePropType>;

const DOG_LAYERS = {
  tail: require('../../assets/dog/runtime/dog-tail.png'),
  body: require('../../assets/dog/runtime/dog-body.png'),
  leftEar: require('../../assets/dog/runtime/dog-ear-left.png'),
  rightEar: require('../../assets/dog/runtime/dog-ear-right.png'),
  head: require('../../assets/dog/runtime/dog-head.png'),
  eyesOpen: require('../../assets/dog/runtime/dog-eyes-open.png'),
  eyesClosed: require('../../assets/dog/runtime/dog-eyes-closed.png'),
} satisfies LayerSet;

// The dog tail asset includes a long hidden root so it can sit behind the
// body. Clip that root before rotating; otherwise its dark edge swings out
// from behind the hind leg. Values are normalized from the 260px runtime art.
const DOG_TAIL_CLIP = {
  left: 188 / 260,
  top: 122 / 260,
  width: 58 / 260,
  height: 94 / 260,
};

type Point = readonly [number, number];

interface PetRig {
  label: string;
  layers: LayerSet;
  pivots: {
    breath: Point;
    tail: Point;
    leftEar: Point;
    rightEar: Point;
  };
  headOffsetY: number;
  motion: {
    tail: number;
    // Lowest mood intensity the tail uses, so a species whose tail is its
    // main sign of life still wags in a low mood. 0 = follow mood fully.
    tailFloor: number;
    ears: number;
    leftEarDirection: -1 | 1;
    rightEarDirection: -1 | 1;
  };
}

const PET_RIGS = {
  cat: {
    label: 'cat',
    layers: CAT_LAYERS,
    pivots: {
      breath: [0.5, 0.9],
      tail: [0.749, 0.7969],
      leftEar: [0.3779, 0.2666],
      rightEar: [0.627, 0.2461],
    },
    headOffsetY: 24 / 1024,
    motion: {
      tail: 1,
      tailFloor: 0,
      ears: 1,
      leftEarDirection: -1,
      rightEarDirection: 1,
    },
  },
  dog: {
    label: 'dog',
    layers: DOG_LAYERS,
    // Pivots were chosen by rotating each part to its tap angle and counting
    // how much of its tucked-in end came out from behind the head or body
    // (2026-09-27). The earlier ear pivots (hidden root centres, y 0.19)
    // swung ear outline out past the cheeks; these lower hinge points expose
    // ~6px at 3 degrees. The tail's hidden base is also trimmed in the art to
    // a band next to where it leaves the body, and a stray ink fragment was
    // removed from the tail layer; up to ~6 degrees then stays clean.
    pivots: {
      breath: [0.5, 0.9],
      tail: [0.68, 0.76],
      leftEar: [0.41, 0.33],
      rightEar: [0.59, 0.33],
    },
    headOffsetY: 0,
    motion: {
      // The floppy parts have shallow hidden overlap. Keep their movement
      // inside it so concealed outlines never pass the body/head silhouette.
      // Up to ~8 degrees: the tail's hidden base is trimmed to a 35px
      // (@3x) circle round its pivot; wider swings showed its edge along
      // the hip outline (2026-09-27).
      tail: 0.65,
      tailFloor: 0.6,
      ears: 0.2,
      // Floppy ears hang out and down from an inner-top hinge, so these
      // directions lift them; the cat's upright ears perk the other way.
      leftEarDirection: 1,
      rightEarDirection: -1,
    },
  },
} satisfies Record<PetSpecies, PetRig>;

const LAYER_COUNT = Object.keys(CAT_LAYERS).length;

// Development only: there the layers are served by Metro, through a tunnel
// slow enough that they arrived one by one, so warm the cache at app launch
// (this module loads with the navigator). A release build reads them from
// the bundle, where prefetch -- meant for remote URLs -- is wasted work.
if (__DEV__) {
  Object.values(PET_RIGS).forEach((rig) => {
    Object.values(rig.layers).forEach((src) => {
      const uri = Image.resolveAssetSource(src)?.uri;
      if (uri?.startsWith('http')) Image.prefetch(uri).catch(() => {});
    });
  });
}

// Mood only scales how much the pet moves; the face is one neutral drawing
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
// once at launch -- turning Reduce Motion on mid-session must still the pet.
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
  species?: PetSpecies;
  size?: number;
  resting?: boolean;
  // False stops every animation and timer -- Home passes its focus state,
  // since a pushed screen (the trip editor) leaves it mounted underneath.
  active?: boolean;
  // Reports whether the pet is showing (false again on a remount), so the
  // caller can reveal what belongs with it (Home's mood title) in step.
  onReadyChange?: (ready: boolean) => void;
}

// Keying the inner component resets its layer gate and every scheduled
// animation when the shared species changes.
export default function SharedPet(props: SharedPetProps) {
  const species = props.species ?? 'cat';
  return <SharedPetInstance key={species} {...props} species={species} />;
}

function SharedPetInstance({
  mood,
  species,
  size = 120,
  resting = false,
  active = true,
  onReadyChange,
}: SharedPetProps & { species: PetSpecies }) {
  const rig = PET_RIGS[species];
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
  // short fallback passes, so a failed load can't hide the pet for good).
  // A set of layer names, not a counter: iOS can fire onLoad twice for one
  // image (e.g. after a resize), which would count a layer twice and reveal
  // the pet with another still missing.
  const [loaded, setLoaded] = React.useState<ReadonlySet<LayerName>>(
    () => new Set()
  );
  const [timedOut, setTimedOut] = React.useState(false);
  React.useEffect(() => {
    // Generous: it only exists so a failed load can't hide the pet forever,
    // and at 800ms it fired before slow dev loads finished.
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);
  const onLayerLoad = React.useCallback(
    (name: LayerName) =>
      setLoaded((prev) => (prev.has(name) ? prev : new Set(prev).add(name))),
    []
  );
  const visible = loaded.size >= LAYER_COUNT || timedOut;
  React.useEffect(() => {
    onReadyChange?.(visible);
  }, [visible, onReadyChange]);
  const lastTap = React.useRef(0);
  // Idle behaviours hold off while a tap reaction plays, instead of cutting
  // it off halfway (a scheduled blink reopening the eyes mid-squint).
  const tapBusyUntil = React.useRef(0);
  const tapBusy = () => Date.now() < tapBusyUntil.current;

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
      const tailIntensity = Math.max(intensity, rig.motion.tailFloor);
      const swish = () => {
        if (tapBusy()) {
          later(swish, rand(400, 900));
          return;
        }
        if (Math.random() < 0.4 * tailIntensity) {
          // 3, 4 or 5 beats, equally likely.
          const beats = 3 + Math.floor(Math.random() * 3);
          const degrees =
            rand(9, 13) * Math.max(tailIntensity, 0.4) * rig.motion.tail;
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
          const rest = rand(1500, 4500) / Math.max(tailIntensity, 0.3);
          later(swish, beat * (beats + 1.5) + rest);
          return;
        }
        const degrees = rand(3.5, 6) * tailIntensity * rig.motion.tail;
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
        const rest = rand(600, 4000) / Math.max(tailIntensity, 0.3);
        later(swish, out + back + settleMs + rest);
      };
      swish();

      const blink = () => {
        if (tapBusy()) {
          later(blink, rand(1000, 2500));
          return;
        }
        const startedAt = Date.now();
        eyesClosed.set(1);
        later(() => {
          // A tap during the blink owns the eyes now; its squint reopens them.
          if (lastTap.current < startedAt) eyesClosed.set(0);
          later(blink, rand(2800, 7000));
        }, 160);
      };
      later(blink, rand(2800, 7000));

      const twitch = (ear: SharedValue<number>, direction: number) => {
        if (tapBusy()) {
          later(() => twitch(ear, direction), rand(600, 1500));
          return;
        }
        const degrees = direction * 4 * intensity * rig.motion.ears;
        ear.set(
          withSequence(
            withTiming(degrees, { duration: 110 }),
            withTiming(-degrees * 0.35, { duration: 120 }),
            withTiming(0, { duration: 150 })
          )
        );
        later(() => twitch(ear, direction), rand(4200, 9400));
      };
      later(
        () => twitch(leftEarRotation, rig.motion.leftEarDirection),
        rand(4200, 9400)
      );
      later(
        () => twitch(rightEarRotation, rig.motion.rightEarDirection),
        rand(4200, 9400)
      );
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
    rig,
    rightEarRotation,
    tailRotation,
  ]);

  // Tapping the pet: a little hop, ears perk, a happy squint and a quick
  // wag, all scaled by mood like the idle motion. Throttled so hammering it
  // doesn't stack animations. With Reduce Motion on it only blinks; resting,
  // its shut eyes half-open for a moment and close again.
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 600) return;
    lastTap.current = now;
    tapBusyUntil.current = now + 900;
    eyesClosed.set(
      resting
        ? withSequence(
            withTiming(0.4, { duration: 260, easing: EASE }),
            withTiming(0.4, { duration: 300 }),
            withTiming(1, { duration: 360, easing: EASE })
          )
        : withSequence(
            withTiming(1, { duration: 60 }),
            withTiming(1, { duration: 220 }),
            withTiming(0, { duration: 80 })
          )
    );
    if (reduceMotion || resting) return;
    const scale = Math.max(MOTION[mood], 0.4);
    const lift = size * 0.05 * scale;
    hop.set(
      withSequence(
        withTiming(-lift, { duration: 140, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 9, stiffness: 180 })
      )
    );
    const perk = 9 * scale * rig.motion.ears;
    leftEarRotation.set(
      withSequence(
        withTiming(rig.motion.leftEarDirection * perk, { duration: 120 }),
        withTiming(0, { duration: 320, easing: EASE })
      )
    );
    rightEarRotation.set(
      withSequence(
        withTiming(rig.motion.rightEarDirection * perk, { duration: 120 }),
        withTiming(0, { duration: 320, easing: EASE })
      )
    );
    tailRotation.set(
      withSequence(
        withTiming(-12 * scale * rig.motion.tail, { duration: 120 }),
        withTiming(12 * scale * rig.motion.tail, { duration: 140 }),
        withTiming(-8 * scale * rig.motion.tail, { duration: 140 }),
        withTiming(0, { duration: 200, easing: EASE })
      )
    );
  };

  const pixelRatio = PixelRatio.get();
  const hopStyle = useAnimatedStyle(() => ({
    // Moving a raster illustration by fractional device pixels makes its
    // hand-drawn outline shimmer, most noticeably around the dog's cheeks.
    transform: [
      {
        translateY: Math.round(hop.get() * pixelRatio) / pixelRatio,
      },
    ],
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
      // From the paws, so the pet rises rather than stretching both ways.
      breath: {
        transformOrigin: [
          size * rig.pivots.breath[0],
          size * rig.pivots.breath[1],
          0,
        ],
      },
      tail: {
        transformOrigin: [
          size * rig.pivots.tail[0],
          size * rig.pivots.tail[1],
          0,
        ],
      },
      dogTailClip: {
        left: size * DOG_TAIL_CLIP.left,
        top: size * DOG_TAIL_CLIP.top,
        width: size * DOG_TAIL_CLIP.width,
        height: size * DOG_TAIL_CLIP.height,
      },
      dogTailImage: {
        left: -size * DOG_TAIL_CLIP.left,
        top: -size * DOG_TAIL_CLIP.top,
        width: size,
        height: size,
      },
      leftEar: {
        transformOrigin: [
          size * rig.pivots.leftEar[0],
          size * rig.pivots.leftEar[1],
          0,
        ],
      },
      rightEar: {
        transformOrigin: [
          size * rig.pivots.rightEar[0],
          size * rig.pivots.rightEar[1],
          0,
        ],
      },
      // Rounded so the head outline and the body's cheek line land on the
      // same device-pixel grid.
      headDrop: {
        transform: [
          {
            translateY: PixelRatio.roundToNearestPixel(size * rig.headOffsetY),
          },
        ],
      },
    }),
    [rig, size]
  );
  const label = resting
    ? `Shared ${rig.label}, resting`
    : `Shared ${rig.label}, ${mood}`;

  // Every layer is a full-canvas image that reports its load by name.
  const layer = (name: LayerName, style?: object) => (
    <Animated.Image
      source={rig.layers[name]}
      onLoad={() => onLayerLoad(name)}
      onError={() => onLayerLoad(name)}
      style={[styles.layer, style]}
      resizeMode="contain"
      fadeDuration={0}
    />
  );

  return (
    <Pressable
      onPress={handleTap}
      // Until it's showing, the pet is neither tappable nor announced --
      // opacity 0 alone leaves both.
      disabled={!visible}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={{ width: size, height: size, opacity: visible ? 1 : 0 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={`Say hi to your ${rig.label}`}
    >
      <Animated.View style={[styles.layer, hopStyle]}>
        <Animated.View style={[styles.layer, pivots.tail, tailStyle]}>
          {species === 'dog' ? (
            <View style={[styles.tailClip, pivots.dogTailClip]}>
              <Image
                source={rig.layers.tail}
                onLoad={() => onLayerLoad('tail')}
                onError={() => onLayerLoad('tail')}
                style={[styles.tailClipImage, pivots.dogTailImage]}
                resizeMode="contain"
                fadeDuration={0}
              />
            </View>
          ) : (
            layer('tail')
          )}
        </Animated.View>
        {/* Everything but the tail breathes together, so the head rises with
            the body instead of the neck seam sliding under a still head. */}
        <Animated.View style={[styles.layer, pivots.breath, breathStyle]}>
          {layer('body')}
          {/* Head, ears and eyes move as one group, lowered onto the body. */}
          <View style={[styles.layer, pivots.headDrop]}>
            <Animated.View style={[styles.layer, pivots.leftEar, leftEarStyle]}>
              {layer('leftEar')}
            </Animated.View>
            <Animated.View
              style={[styles.layer, pivots.rightEar, rightEarStyle]}
            >
              {layer('rightEar')}
            </Animated.View>
            {layer('head')}
            {layer('eyesOpen', eyesOpenStyle)}
            {layer('eyesClosed', eyesClosedStyle)}
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  tailClip: {
    position: 'absolute',
    overflow: 'hidden',
  },
  tailClipImage: {
    position: 'absolute',
  },
});
