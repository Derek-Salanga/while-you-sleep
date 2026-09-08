import React, { useMemo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

// A handful of emoji drifting up over the video, then gone.
//
// This is deliberately louder than the rest of the app's motion, which is
// otherwise all sub-300ms (press-scale 100ms, Timeline entrance 180ms + up
// to 100ms stagger). Rising half a screen inside that budget would be a
// blur rather than a rise, so the duration is set by the distance. If this
// ever starts feeling like too much, the four constants below are the whole
// dial -- reduce COUNT first, it's the loudest of them.
const COUNT = 6;
const RISE_FRACTION = 0.5; // of screen height
const DURATION_MS = 1400;
const STAGGER_MS = 90;
const SPREAD = 210; // horizontal wander, px

const { height: SCREEN_H } = Dimensions.get('window');
const RISE = SCREEN_H * RISE_FRACTION;

interface Seed {
  dx: number;
  delay: number;
  scale: number;
  drift: number;
}

function Particle({
  emoji,
  seed,
  onDone,
}: {
  emoji: string;
  seed: Seed;
  onDone?: () => void;
}) {
  const t = useSharedValue(0);
  // withDelay holds the *animation*, not the view: without this the particle
  // is already mounted at t = 0, so it renders full-opacity and un-moved,
  // parked at the bottom of the screen until its turn. This flips on the
  // instant its delay elapses, so a staggered particle is genuinely absent
  // rather than waiting in place.
  const spawned = useSharedValue(0);

  React.useEffect(() => {
    t.value = 0;
    spawned.value = 0;
    spawned.value = withDelay(seed.delay, withTiming(1, { duration: 1 }));
    t.value = withDelay(
      seed.delay,
      withTiming(
        1,
        // Decelerating: they leave quickly and settle out, rather than
        // travelling at a constant speed, which reads mechanical.
        { duration: DURATION_MS, easing: Easing.out(Easing.quad) },
        (finished) => {
          if (finished && onDone) runOnJS(onDone)();
        }
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const p = t.value;
    return {
      // Holds full opacity for the first third, then fades -- fading from
      // the very start makes them look like they were never really there.
      // Multiplied by `spawned` so nothing is visible before it launches.
      opacity: spawned.value * (p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65),
      transform: [
        { translateY: -RISE * p },
        // A sine wander rather than a straight line, so six of them don't
        // read as one thick column.
        { translateX: seed.dx + Math.sin(p * Math.PI * seed.drift) * 26 },
        { scale: seed.scale * (0.7 + 0.3 * Math.min(p * 4, 1)) },
      ],
    };
  });

  return <Animated.Text style={[styles.emoji, style]}>{emoji}</Animated.Text>;
}

interface ReactionBurstProps {
  // Changing this replays the burst; null means nothing to play. The parent
  // bumps a counter alongside the emoji so re-picking the same one fires.
  token: number;
  emoji: string | null;
  onDone: () => void;
}

export default function ReactionBurst({
  token,
  emoji,
  onDone,
}: ReactionBurstProps) {
  // Re-rolled per burst so two taps never look identical, but stable within
  // one so particles don't jump on re-render.
  const seeds = useMemo<Seed[]>(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        dx: (Math.random() - 0.5) * SPREAD,
        delay: i * STAGGER_MS,
        scale: 0.75 + Math.random() * 0.5,
        drift: 1 + Math.random(),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token]
  );

  if (!emoji) return null;

  return (
    <Animated.View
      style={styles.layer}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {seeds.map((seed, i) => (
        // Keyed by token so a replay remounts every particle and restarts
        // its animation from zero.
        <Particle
          key={`${token}-${i}`}
          emoji={emoji}
          seed={seed}
          // Only the last particle to finish reports back, so the parent
          // clears once rather than COUNT times.
          onDone={i === COUNT - 1 ? onDone : undefined}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // A full-screen sibling rather than a child of the reaction row: Android
  // clips absolutely-positioned children that extend past their parent, and
  // these are meant to travel half a screen out of it.
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 90,
  },
  emoji: {
    position: 'absolute',
    fontSize: 30,
  },
});
