import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { updateProfile } from '@/services/api/profileService';
import { useAuthStore } from '@/store/authStore';

export type Theme = 'light' | 'dark';
export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'cl_theme';

export interface ThemeContextValue {
  theme: Theme;
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(pref: ThemePreference): Theme {
  if (pref === 'light' || pref === 'dark') return pref;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function applyTheme(theme: Theme, animate: boolean) {
  const root = document.documentElement;

  if (animate) {
    root.classList.add('theme-transitioning');
  }

  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  if (animate) {
    setTimeout(() => root.classList.remove('theme-transitioning'), 200);
  }
}

export function useThemeProvider(): ThemeContextValue {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(getStoredPreference);
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(getStoredPreference()));
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUser = useAuthStore((s) => s.currentUser);

  // Sync backend preference to local on login/user change
  useEffect(() => {
    if (!currentUser?.themePreference) return;
    const backendPref = currentUser.themePreference as ThemePreference;
    const localPref = getStoredPreference();
    if (backendPref !== localPref) {
      localStorage.setItem(STORAGE_KEY, backendPref);
      setThemePreferenceState(backendPref);
      const resolved = resolveTheme(backendPref);
      setTheme(resolved);
      applyTheme(resolved, false);
    }
  }, [currentUser?.themePreference]);

  // Listen for OS preference changes when set to "system"
  useEffect(() => {
    if (themePreference !== 'system') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved = resolveTheme('system');
      setTheme(resolved);
      applyTheme(resolved, true);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [themePreference]);

  // Apply theme on mount (covers React hydration after inline script)
  useEffect(() => {
    applyTheme(theme, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setThemePreference = useCallback(
    (pref: ThemePreference) => {
      localStorage.setItem(STORAGE_KEY, pref);
      setThemePreferenceState(pref);
      const resolved = resolveTheme(pref);
      setTheme(resolved);
      applyTheme(resolved, true);

      // Persist to backend if authenticated (fire-and-forget)
      if (isAuthenticated) {
        updateProfile({ themePreference: pref }).catch(() => {
          // Non-critical — localStorage is the source of truth for UX
        });
      }
    },
    [isAuthenticated]
  );

  return { theme, themePreference, setThemePreference };
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
