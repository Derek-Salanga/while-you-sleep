import * as Notifications from 'expo-notifications';

// Fixed identifiers so re-scheduling (e.g. on every app launch) replaces
// the existing request instead of piling up duplicates.
const QUESTION_REMINDER_ID = 'daily-question-reminder';
const CLIP_REMINDER_ID = 'daily-clip-reminder';

const REMINDER_HOUR = 20; // 8:00 PM local time, both reminders together
const REMINDER_MINUTE = 0;

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

  await Notifications.scheduleNotificationAsync({
    identifier: QUESTION_REMINDER_ID,
    content: {
      title: "Today's question is up",
      body: 'Answer it before your partner does.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
    },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: CLIP_REMINDER_ID,
    content: {
      title: 'Record your daily clip',
      body: "Don't forget to send today's clip before you sleep.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
    },
  });
}
