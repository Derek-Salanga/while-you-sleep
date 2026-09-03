// Where a notification tap should land.
//
// Kept separate from notifications.ts, and pure, for two reasons: that
// module runs `setNotificationHandler` at import time, and this is a branch
// on data we don't control. A remote push payload is whatever the sending
// server put in it, so this validates rather than casts, and anything
// unrecognised falls through to Home — which is where every notification
// landed before payload routing existed.

export type NotificationType = 'daily-reminder' | 'partner-posted';

export type NotificationDestination = 'Home' | 'Record';

export function routeForNotification(data: unknown): NotificationDestination {
  const type = (data as { type?: unknown } | null | undefined)?.type;

  // ponytail: `partner-posted` opens Record, not the partner's clip itself.
  // ClipView would fail on exactly the common case -- if you haven't posted
  // that day, clips_select_pair_members hides their row and useClip's
  // .single() errors -- whereas RecordScreen's loadTodayClips already
  // resolves to `revealed` (both clips, tap either) or `camera` on its own.
  // Route straight to ClipView only once the handler checks your own-post
  // state first.
  return type === 'partner-posted' ? 'Record' : 'Home';
}
