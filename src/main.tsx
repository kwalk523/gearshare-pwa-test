'use client';

import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './routes/auth/LoginPage';
import SetupProfile from './routes/auth/SetupProfile';
// Legacy components (Dashboard, MyRentals) no longer directly routed
import LendDashboard from './routes/lend/LendDashboard';
import RentDashboard from './routes/rent/RentDashboard';
import BrowsePage from './routes/browse/BrowsePage';
import ReturnGear from './components/ReturnGear';
import ProfilePage from './routes/profile/ProfilePage';
import PublicProfile from './routes/profile/PublicProfile';
import Clubs from './components/Clubs';
import VerifyStudent from './routes/profile/VerifyStudent';
import Students from './routes/profile/Students';
import Messages from './routes/messages/Messages';
import Favorites from './components/Favorites';
import { UserProvider } from './context/UserContext';
import { NotificationProvider } from './context/NotificationContext';
import { GearProvider } from './context/GearContext';

// ✅ All routes are now wrapped in the UserProvider and NotificationProvider for global access
export function AppRoutes() {
  return (
    <BrowserRouter>
      <UserProvider>
        <NotificationProvider>
          <GearProvider>
          <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes with Layout */}
          <Route
            path="/setup-profile"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SetupProfile />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Legacy /dashboard route now redirects to /rent */}
          <Route path="/dashboard" element={<Navigate to="/rent" replace />} />
          {/* New standalone browse route */}
          <Route
            path="/browse"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <BrowsePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/lend"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <LendDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* /rentals now part of unified rent dashboard */}
          <Route path="/rentals" element={<Navigate to="/rent" replace />} />
          <Route
            path="/rent"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <RentDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/listings"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ReturnGear />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* ✅ Profile Route */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ProfilePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Public/Visitor Profile Route */}
          <Route
            path="/profile/:id"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PublicProfile />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Clubs Directory */}
          <Route
            path="/clubs"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Clubs />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Verify Student */}
          <Route
            path="/verify-student"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <VerifyStudent />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Students Directory */}
          <Route
            path="/students"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Students />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Messages */}
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Messages />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Favorites */}
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Favorites />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all: Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/browse" replace />} />
          </Routes>
          </GearProvider>
        </NotificationProvider>
      </UserProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoutes />
  </StrictMode>
);

