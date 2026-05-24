import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'ramiarz-theme';
const CYCLE = ['system', 'light', 'dark'];

function isDark(theme) {
  if (theme === 'dark')  return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'system'
  );

  useEffect(() => {
    const apply = () =>
      document.documentElement.classList.toggle('dark', isDark(theme));

    apply();

    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = (t) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  };

  const cycleTheme = () =>
    setTheme(CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
