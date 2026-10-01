import { Alert } from 'react-native';

// Two chained Alerts, same shape as AccountSettingsScreen's
// confirmDeleteAccount -- Alert.prompt is iOS-only in React Native, and the
// Android equivalent would need a custom Modal, which is exactly what six
// rounds of device crashes came from here (docs/datepicker-debugging.md).
//
// Exported so ClipViewScreen's "Block" option (offered after a report) and
// AccountSettingsScreen's "Block" row run the identical confirmation rather
// than two copies that could drift apart. onConfirm is the caller's
// useBlockPartner().mutate call, including its own onError -- this function
// only owns the two Alerts, not the mutation.
export function confirmBlockPartner(
  partnerName: string | null,
  onConfirm: () => void
) {
  const name = partnerName ?? 'your partner';
  Alert.alert(
    `Block ${name}?`,
    `This ends your pairing and permanently deletes your shared history (clips, reactions, trip, anniversary) for both of you. They won't be able to pair with you again.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        onPress: () =>
          Alert.alert('Are you sure?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Block', style: 'destructive', onPress: onConfirm },
          ]),
      },
    ]
  );
}
