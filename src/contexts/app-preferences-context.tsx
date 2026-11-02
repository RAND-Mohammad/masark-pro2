import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setDesignScheme, type DesignScheme } from '../constants/design';

export type AppLanguage = 'ar' | 'en';
export type ThemeChoice = 'system' | 'light' | 'dark';
type Preferences = { language: AppLanguage; theme: ThemeChoice };
type PreferencesState = Preferences & {
  ready: boolean;
  effectiveTheme: DesignScheme;
  setLanguage: (language: AppLanguage) => Promise<void>;
  setTheme: (theme: ThemeChoice) => Promise<void>;
};

const STORAGE_KEY = 'masarak-app-preferences-v1';
const defaults: Preferences = { language: 'ar', theme: 'system' };
const PreferencesContext = createContext<PreferencesState | null>(null);

function readPreferences(raw: string | null): Preferences {
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      language: parsed.language === 'en' ? 'en' : 'ar',
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'system',
    };
  } catch { return defaults; }
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme() ?? 'light';
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const effectiveTheme: DesignScheme = preferences.theme === 'system' ? systemScheme : preferences.theme;
  // Update the token source before child screens render and resolve their cached styles.
  setDesignScheme(effectiveTheme);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (active) setPreferences(readPreferences(raw));
    }).catch(() => {
      if (active) setPreferences(defaults);
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // React Native Web versions may not expose setColorScheme. The web theme
    // is applied below through document attributes and design tokens.
    if (typeof Appearance.setColorScheme === 'function') {
      Appearance.setColorScheme(preferences.theme === 'system' ? 'auto' : preferences.theme);
    }
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = preferences.language;
      document.documentElement.dir = preferences.language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.dataset.theme = effectiveTheme;
    }
  }, [effectiveTheme, preferences.language, preferences.theme]);

  const update = useCallback(async (patch: Partial<Preferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch (error) { setPreferences(preferences); throw error; }
  }, [preferences]);
  const setLanguage = useCallback((language: AppLanguage) => update({ language }), [update]);
  const setTheme = useCallback((theme: ThemeChoice) => update({ theme }), [update]);

  const value = useMemo(() => ({ ...preferences, ready, effectiveTheme, setLanguage, setTheme }),
    [preferences, ready, effectiveTheme, setLanguage, setTheme]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useAppPreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('AppPreferencesProvider missing');
  return value;
}
