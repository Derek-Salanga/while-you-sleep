import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { utcTimeToLocal } from './date';
import { NotificationType } from './notificationRouting';
import { supabase } from './supabase';

// 8:00 PM UTC, not local -- deliberately pinned to the same clock the
// pair's shared day boundary uses (see "Two day boundaries" in
// CLAUDE.md). At a local 8pm, anyone far enough west was reminded
// *after* the UTC day had already rolled over, so the nudge pointed at
// the next day's question. 20:00 UTC always lands 4 hours before the
// boundary, so it always refers to the day it's actually reminding about,
// and both partners get it at the same moment.
//
// Tradeoff: the local hour now varies by timezone (13:00 at UTC-7, 05:00
// in Tokyo) rather than being a consistent evening nudge everywhere.
const REMINDER_UTC_HOUR = 20;
const REMINDER_UTC_MINUTE = 0;
const ANDROID_CHANNEL_ID = 'daily-reminders';
// Reaction pushes ask for a lower-importance channel by id (see
// notify_sender_of_reaction in schema.sql). Android drops or de-prioritizes
// a notification naming a channel that doesn't exist on the device, so it
// has to be created here even though nothing local ever posts to it.
const REACTIONS_CHANNEL_ID = 'reactions';

// Fixed identifier so re-scheduling (e.g. on every app launch) replaces
// the existing request instead of piling up duplicates.
const REMINDERS = [
  {
    identifier: 'daily-question-reminder',
    title: "Today's question is up",
    body: 'Record your video answer before your partner does.',
  },
];

// Answering the daily question used to be a separate, text-only step from
// recording the daily clip -- now the clip IS the answer (see "Video daily
// question" in CLAUDE.md), so this reminder was merged into the one above.
// A device that already had it scheduled from before this change would
// otherwise keep firing it forever, since nothing re-schedules-to-replace
// an identifier this code no longer calls.
const RETIRED_REMINDER_IDS = ['daily-clip-reminder'];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Schedules the two daily reminders as repeating local notifications —
// no backend/push infra involved, so this only needs to run once (it's
// safe to call again; it replaces the existing requests by identifier).
export async function ensureDailyRemindersScheduled(): Promise<void> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  // Android 8+ silently drops or de-prioritizes notifications with no
  // explicit channel; harmless no-op on iOS, so no Platform guard needed
  // for correctness, but it's genuinely only meaningful on Android.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Daily reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    // LOW rather than DEFAULT: a reaction is a warm signal, not a call to
    // action -- it shows in the shade without a sound or heads-up banner.
    await Notifications.setNotificationChannelAsync(REACTIONS_CHANNEL_ID, {
      name: 'Reactions',
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
    });
  }

  await Promise.all(
    RETIRED_REMINDER_IDS.map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier)
    )
  );

  // The DAILY trigger takes a device-local hour/minute with no timezone
  // field, so translate the target UTC time for this device.
  //
  // This is recomputed on every call, which matters: a DST transition
  // shifts which local time corresponds to 20:00 UTC, and the already-
  // scheduled trigger is a fixed local hour, so it would drift an hour
  // off. Re-scheduling replaces by identifier, so the next launch after
  // a transition self-corrects. Between the transition and that launch
  // the reminder can be an hour early/late -- acceptable for a nudge,
  // and the alternative (an app that must be open to stay correct) isn't
  // better.
  const { hour, minute } = utcTimeToLocal(
    REMINDER_UTC_HOUR,
    REMINDER_UTC_MINUTE
  );

  await Promise.all(
    REMINDERS.map((reminder) =>
      Notifications.scheduleNotificationAsync({
        identifier: reminder.identifier,
        content: {
          title: reminder.title,
          body: reminder.body,
          // Read back by RootNavigator's response listener to decide where
          // a tap lands -- see routeForNotification.
          data: { type: 'daily-reminder' satisfies NotificationType },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: ANDROID_CHANNEL_ID,
        },
      })
    )
  );
}

// Records this device's Expo push token so the server can reach it when the
// partner posts. Safe to call on every launch: it upserts on
// (user_id, token), which just refreshes updated_at for a device already
// known -- and that refresh is what the stale-row prune keys off, so a
// device that stops launching eventually drops out on its own.
//
// A rotated token inserts a second row rather than replacing the old one.
// That's deliberate: there's no way to tell locally which of your rows the
// rotation retired, and sending to a dead token is harmless.
export async function registerPushToken(userId: string): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  let token: string;
  try {
    // projectId is required here -- without it Expo can't tell which
    // project's credentials to mint against. It comes from `eas init`.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as
      string | undefined;
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (err) {
    // Expected wherever the app isn't a real build with push credentials:
    // Expo Go (remote push was removed from it in SDK 53) and the iOS
    // Simulator, which has no APNs connection at all. Not an error worth
    // surfacing -- the rest of the app is unaffected.
    console.warn('Push token unavailable on this build:', err);
    return;
  }

  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform: Platform.OS },
      { onConflict: 'user_id,token' }
    );
  if (error) throw error;
}

// Drops this device's token for the signing-out user, so their partner's
// pushes stop reaching a phone they no longer own the session on.
//
// Without this, every account ever signed into a device keeps a live row
// pointing at it -- sign out, hand the phone over, someone else signs in,
// and the previous user's partner still notifies that device by name. Found
// in real data: six rows across five user_ids for two physical devices,
// every one of them still live.
//
// Scoped to (this user, this token) rather than every row for the token:
// push_tokens_delete_own only permits `auth.uid() = user_id` anyway, and a
// shared device's *other* accounts are not this session's business.
//
// Never throws. Sign-out has to succeed even if this doesn't -- being unable
// to reach Supabase is not a reason to strand someone in a session they
// asked to leave. A row left behind is swept by the 60-day prune.
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as
      string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token);
  } catch (err) {
    console.warn('Could not drop push token on sign out:', err);
  }
}
