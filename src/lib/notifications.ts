import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const REMINDER_HOUR = 20; // 8:00 PM local time
const REMINDER_MINUTE = 0;
const ANDROID_CHANNEL_ID = 'daily-reminders';

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
  }

  await Promise.all(
    RETIRED_REMINDER_IDS.map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier)
    )
  );

  await Promise.all(
    REMINDERS.map((reminder) =>
      Notifications.scheduleNotificationAsync({
        identifier: reminder.identifier,
        content: { title: reminder.title, body: reminder.body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: REMINDER_HOUR,
          minute: REMINDER_MINUTE,
          channelId: ANDROID_CHANNEL_ID,
        },
      })
    )
  );
}
