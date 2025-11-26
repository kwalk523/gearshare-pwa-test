'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  return (
    <button
      className="p-2 rounded-full hover:bg-indigo-100 transition"
      onClick={() => setDark((d) => !d)}
      aria-label="Toggle dark mode"
    >
      {dark ? <Moon className="w-5 h-5 text-indigo-700" /> : <Sun className="w-5 h-5 text-yellow-500" />}
    </button>
  );
}
