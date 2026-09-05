// Where a notification tap should land.
//
// Kept separate from notifications.ts, and pure, for two reasons: that
// module runs `setNotificationHandler` at import time, and this is a branch
// on data we don't control. A remote push payload is whatever the sending
// server put in it, so this validates rather than casts, and anything
// unrecognised falls through to Home — which is where every notification
// landed before payload routing existed.

export type NotificationType = 'daily-reminder' | 'partner-posted' | 'reaction';

export type NotificationDestination =
  | { screen: 'Home' }
  | { screen: 'Record' }
  | { screen: 'ClipView'; clipId: string };

export function routeForNotification(data: unknown): NotificationDestination {
  const payload = (data ?? {}) as { type?: unknown; clipId?: unknown };

  // ponytail: `partner-posted` opens Record, not the partner's clip.
  // ClipView would fail on the common case -- if you haven't posted that
  // day, clips_select_pair_members hides their row and useClip's .single()
  // errors -- whereas RecordScreen's loadTodayClips already resolves to
  // `revealed` (both clips, tap either) or `camera` on its own. Route
  // straight to ClipView only once the handler checks your own-post state.
  if (payload.type === 'partner-posted') return { screen: 'Record' };

  // A reaction goes straight to the clip, unlike partner-posted. Safe here:
  // you can only be reacted to on a clip you sent, and
  // clips_select_pair_members always shows you your own, so there is no
  // reveal-gated state where this route would break.
  //
  // The clipId is still checked rather than trusted -- it arrives from the
  // network, and navigating to ClipView without one would render the
  // "Couldn't load this clip" state instead of doing nothing.
  if (payload.type === 'reaction' && typeof payload.clipId === 'string') {
    return { screen: 'ClipView', clipId: payload.clipId };
  }

  return { screen: 'Home' };
}
