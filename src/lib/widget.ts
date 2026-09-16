import { ExtensionStorage } from '@bacons/apple-targets';

// The one value the iOS widget needs. It derives the day count itself from
// this plus the current date, so nothing has to be rewritten as days pass --
// see targets/widget/widgets.swift.
//
// Must match the App Group in app.json's ios.entitlements and in
// targets/widget/expo-target.config.js. A mismatch isn't an error, it's
// silence: the widget reads a different (empty) container and sits on its
// "not set yet" state.
const APP_GROUP = 'group.com.whileyousleep.app';
const ANNIVERSARY_KEY = 'anniversaryDate';

const storage = new ExtensionStorage(APP_GROUP);

// Safe to call anywhere: with no native module present -- Expo Go, Android,
// the web bundle -- ExtensionStorage falls back to no-op stubs rather than
// throwing, so this needs no platform guard of its own.
export function syncAnniversaryWidget(date: string | null) {
  // Removing rather than writing an empty string is what puts the widget back
  // on its "not set yet" prompt -- widgets.swift keys off the absence of the
  // value, not a sentinel.
  if (date) {
    storage.set(ANNIVERSARY_KEY, date);
  } else {
    storage.remove(ANNIVERSARY_KEY);
  }
  ExtensionStorage.reloadWidget();
}
