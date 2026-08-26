import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const REMINDER_HOUR = 20; // 8:00 PM local time, both reminders together
const REMINDER_MINUTE = 0;
const ANDROID_CHANNEL_ID = 'daily-reminders';

// Fixed identifiers so re-scheduling (e.g. on every app launch) replaces
// the existing request instead of piling up duplicates.
const REMINDERS = [
  {
    identifier: 'daily-question-reminder',
    title: "Today's question is up",
    body: 'Answer it before your partner does.',
  },
  {
    identifier: 'daily-clip-reminder',
    title: 'Record your daily clip',
    body: "Don't forget to send today's clip before you sleep.",
  },
];

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
