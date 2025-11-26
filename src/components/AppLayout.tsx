'use client';

import { useLocation } from 'react-router-dom';
import NavBar from './NavBar/NavBar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  // NavBar shows everywhere except login, splash, or signup
  const showNav = !['/login', '/', '/signup'].includes(pathname);

  return (
  <div className="relative min-h-screen bg-app">
      {showNav && <NavBar />}
      <main>
        {children}
      </main>
    </div>
  );
}


