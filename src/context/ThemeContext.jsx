import { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

function getInitialTheme() {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function applyTheme(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const initial = getInitialTheme();
    setIsDarkMode(initial);
    applyTheme(initial);
  }, []);

  const setLightMode = () => {
    setIsDarkMode(false);
    applyTheme(false);
    localStorage.setItem('theme', 'light');
  };

  const setDarkMode = () => {
    setIsDarkMode(true);
    applyTheme(true);
    localStorage.setItem('theme', 'dark');
  };

  const toggleDarkMode = () => {
    if (isDarkMode) setLightMode();
    else setDarkMode();
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, setLightMode, setDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
