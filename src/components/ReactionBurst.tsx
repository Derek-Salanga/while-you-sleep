import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

// A single emoji rising off the chip you just tapped, then gone.
//
// Sized to the motion already in this app rather than to what an emoji
// burst usually looks like elsewhere: press-scale is 100ms and the Timeline
// entrance is 180ms with at most 100ms of stagger, so anything past ~300ms
// would read as a different app. One copy, not a shower -- a shower is a
// celebration, and this is closer to a nod.
const RISE_MS = 260;
const RISE_DISTANCE = 40;

interface ReactionBurstProps {
  // Changing this re-runs the animation; null means nothing to play. The
  // parent bumps a counter alongside the emoji so tapping the same one
  // twice still fires.
  token: number;
  emoji: string | null;
  onDone: () => void;
}

export default function ReactionBurst({
  token,
  emoji,
  onDone,
}: ReactionBurstProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!emoji) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: RISE_MS }, (finished) => {
      // Clearing the emoji is the parent's job, so the component unmounts
      // its own work rather than leaving a spent copy on screen. runOnJS
      // because the callback runs on the UI thread.
      if (finished) runOnJS(onDone)();
    });
    // token is the dependency that matters: re-tapping the same emoji has
    // to replay, and emoji alone wouldn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: -RISE_DISTANCE * progress.value }],
  }));

  if (!emoji) return null;

  return (
    <Animated.Text
      style={[styles.burst, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  // Absolute so it can't reflow the row it rises out of -- the picker must
  // not shift under a finger that's still on it.
  burst: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 28,
  },
});
