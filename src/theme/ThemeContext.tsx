import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, lightTheme, darkTheme } from './themes';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'themePreference';

interface ThemeContextValue {
  theme: Theme;
  // What the user chose, which is not the same as what is being shown:
  // 'system' resolves to either. Settings needs the choice, everything else
  // needs the resolved theme.
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Read once on mount. Rendering the default for a frame is fine; blocking
  // the whole app behind a disk read to avoid one frame is not.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      })
      .catch((err) => console.warn('Could not read theme preference:', err));
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    // Applied immediately, persisted in the background: a theme toggle that
    // waits on storage feels broken, and a failed write only costs the
    // choice on next launch.
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch((err) =>
      console.warn('Could not save theme preference:', err)
    );
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const resolved =
      preference === 'system' ? (systemScheme ?? 'light') : preference;
    return {
      theme: resolved === 'dark' ? darkTheme : lightTheme,
      preference,
      setPreference,
    };
  }, [preference, systemScheme, setPreference]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx.theme;
}

// Separate from useTheme so the common case -- a component that just wants
// colours -- doesn't re-render when the *preference* changes but the
// resolved theme doesn't (picking "light" while the system is already light).
export function useThemePreference() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemePreference must be used within a ThemeProvider');
  }
  return { preference: ctx.preference, setPreference: ctx.setPreference };
}
