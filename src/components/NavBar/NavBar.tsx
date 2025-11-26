'use client';

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, User, LogOut, List, ShoppingBag, CheckCircle, Grid, Heart, MessageSquare } from 'lucide-react';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import InstallCTA from "../InstallCTA"; // ✅ Added InstallCTA import
import { supabase } from "../../lib/supabase";
import { useUser } from '../../context/UserContext';
import { useUnreadCount } from '../../hooks/useUnreadCount';

const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="%23e5e7eb"/><circle cx="48" cy="36" r="16" fill="%239ca3af"/><path d="M16 80c0-13.255 14.327-24 32-24s32 10.745 32 24" fill="%239ca3af"/></svg>';

// Primary quick-access items (kept minimal for declutter)
const QUICK_LINKS = [
  { label: 'Browse', path: '/browse', icon: ShoppingBag },
  { label: 'Rent', path: '/rent', icon: List },
  { label: 'Lend', path: '/lend', icon: Grid },
  { label: 'Messages', path: '/messages', icon: MessageSquare },
  { label: 'Favorites', path: '/favorites', icon: Heart },
];

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [currentUser, setCurrentUser] = useState<{
    fullName: string;
    email: string;
    profilePic: string;
  }>({ fullName: 'Student', email: '', profilePic: DEFAULT_AVATAR });

  const { user } = useUser();
  const { unreadCount } = useUnreadCount();

  useEffect(() => {
    if (!user) {
      setCurrentUser({ fullName: 'Student', email: '', profilePic: DEFAULT_AVATAR });
      return;
    }

    const fullName = user.full_name || (user.email ? user.email.split('@')[0] : 'Student');
    const picPath = user.profile_pic;
    const profilePicUrl = picPath
      ? (picPath.startsWith('http')
          ? picPath
          : supabase.storage.from('profile-pics').getPublicUrl(picPath).data.publicUrl)
      : DEFAULT_AVATAR;

    setCurrentUser({
      fullName,
      email: user.email,
      profilePic: profilePicUrl,
    });
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileOpen && profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  function handleLogout() {
    supabase.auth.signOut();
    navigate('/login');
  }

  const [usingKeyboard, setUsingKeyboard] = useState(false);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') setUsingKeyboard(true);
    };
    const handleMouse = () => setUsingKeyboard(false);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleMouse);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleMouse);
    };
  }, []);

  return (
    <nav className="w-full bg-white/90 shadow-md sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/browse" className="flex items-center gap-3 text-2xl font-bold text-indigo-600 tracking-tight shrink-0">
          <ShoppingBag className="w-8 h-8 text-indigo-700" />
          GearShare
        </Link>

        {/* Compact icon bar (desktop) */}
        <div className="hidden md:flex items-center gap-2 ml-8 flex-1">
          <div className="flex items-center gap-1 bg-white/60 rounded-full px-2 py-1 shadow-inner">
            {QUICK_LINKS.map(item => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              const commonClasses = `group relative flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                isActive ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
              } ${usingKeyboard ? 'focus:outline-dashed focus:outline-2 focus:outline-indigo-500' : 'focus:outline-none'}`;
              return (
                <Link
                  key={item.label}
                  to={item.path!}
                  className={commonClasses}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                  {item.label === 'Messages' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right section: Profile, etc. */}
        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell />
          <ThemeToggle />
          <InstallCTA /> {/* ✅ Render InstallCTA here */}
          
          {/* Mobile menu button */}
          <button
            className="block md:hidden p-2 hover:bg-indigo-100 rounded"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Profile avatar */}
          <div className="relative ml-3" ref={profileRef}>
            <button
              className="flex items-center gap-2 focus:outline-none"
              onClick={() => setProfileOpen(!profileOpen)}
              aria-haspopup="true"
              aria-expanded={profileOpen}
            >
              <img
                src={currentUser.profilePic}
                alt="profile"
                className="w-9 h-9 object-cover rounded-full border-2 border-indigo-300"
              />
              <span className="hidden sm:inline ml-1 text-gray-800 text-lg font-medium">
                {currentUser.fullName}
              </span>
            </button>

            {/* Profile dropdown */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-40 animate-fade-in">
                <div className="px-4 py-2 border-b border-gray-100">
                  <span className="block font-semibold text-gray-900">{currentUser.fullName}</span>
                  <span className="block text-sm text-gray-500 truncate">{currentUser.email}</span>
                </div>
                <button
                  className="w-full px-4 py-2 text-left hover:bg-indigo-50 flex items-center gap-2"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/profile');
                  }}
                >
                  <User className="w-5 h-5" /> My Profile
                </button>
                <button
                  className="w-full px-4 py-2 text-left hover:bg-indigo-50 flex items-center gap-2"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/rentals');
                  }}
                >
                  <List className="w-5 h-5" /> My Rentals
                </button>
                <button
                  className="w-full px-4 py-2 text-left hover:bg-indigo-50 flex items-center gap-2"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/listings');
                  }}
                >
                  <CheckCircle className="w-5 h-5" /> Return Gear
                </button>
                <div className="border-t my-2" />
                <button
                  className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                  onClick={handleLogout}
                >
                  <LogOut className="w-5 h-5" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div className="md:hidden bg-white shadow-md border-t border-gray-100">
          <ul className="px-4 py-3 space-y-1">
            {QUICK_LINKS.map(item => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <Link
                    to={item.path!}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium ${
                      isActive ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-indigo-50'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="w-5 h-5" /> {item.label}
                    {item.label === 'Messages' && unreadCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}
