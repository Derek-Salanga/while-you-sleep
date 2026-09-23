import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { Theme } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, fontSizes } from '@/theme/typography';

// The app's one date input (trip editor, anniversary editor). Every rule
// from docs/datepicker-debugging.md lives here so it can't drift between
// copies:
// - never inside a Modal;
// - no minimumDate/maximumDate -- callers check the range on Save;
// - iOS: an inline spinner in a fixed-height box, because a zero-size frame
//   mid-transition can reset UIDatePicker to the Unix epoch;
// - Android: no <DateTimePicker> component at all. It opens its dialog from
//   an effect keyed on onChange, so while mounted any re-render reopens it;
//   a row calling DateTimePickerAndroid.open() has no such effect.
export default function DateField({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  if (Platform.OS === 'android') {
    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() =>
          DateTimePickerAndroid.open({
            value,
            mode: 'date',
            onChange: (_, date) => date && onChange(date),
          })
        }
        accessibilityRole="button"
      >
        <Text style={styles.rowText}>
          {value.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.spinnerBox}>
      <DateTimePicker
        // Follows the OS appearance by default, not the app's -- so a user on
        // System=dark with the app forced Light would get a dark picker on a
        // light sheet.
        themeVariant={t.name}
        value={value}
        mode="date"
        display="spinner"
        onChange={(_, date) => date && onChange(date)}
      />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    rowText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.md,
      color: t.textPrimary,
    },
    spinnerBox: {
      height: 216,
    },
    pressed: {
      opacity: 0.7,
    },
  });
