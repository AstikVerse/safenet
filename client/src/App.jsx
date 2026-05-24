import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

// Import Screens
import SplashScreen from './pages/SplashScreen.jsx';
import LoginRegister from './pages/LoginRegister.jsx';
import Home from './pages/Home.jsx';
import CheckinTimer from './pages/CheckinTimer.jsx';
import CommunityMap from './pages/CommunityMap.jsx';
import TrustedContacts from './pages/TrustedContacts.jsx';
import Profile from './pages/Profile.jsx';
import FakeCallScreen from './pages/FakeCallScreen.jsx';
import ContactTrackingPage from './pages/ContactTrackingPage.jsx';

// Private Route Guard Component
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="phone-container bg-background-warm flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-bold text-dark-muted tracking-wider uppercase">Loading Session...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/auth" replace />;
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public Screens */}
        <Route path="/" element={<SplashScreen />} />
        <Route path="/auth" element={<LoginRegister />} />
        
        {/* Token-Authorized Public SOS Tracking Screen (No login needed) */}
        <Route path="/track/:id" element={<ContactTrackingPage />} />

        {/* Private Screens Guarded by Authentication */}
        <Route
          path="/home"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/checkin"
          element={
            <PrivateRoute>
              <CheckinTimer />
            </PrivateRoute>
          }
        />
        <Route
          path="/map"
          element={
            <PrivateRoute>
              <CommunityMap />
            </PrivateRoute>
          }
        />
        <Route
          path="/contacts"
          element={
            <PrivateRoute>
              <TrustedContacts />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />
        <Route
          path="/fake-call"
          element={
            <PrivateRoute>
              <FakeCallScreen />
            </PrivateRoute>
          }
        />

        {/* Catch-all Wildcard Route redirects to Welcome splash */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
