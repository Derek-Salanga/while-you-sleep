import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '@/types';

// Lets code outside the component tree (the notification tap handler)
// navigate without needing a `navigation` prop.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
