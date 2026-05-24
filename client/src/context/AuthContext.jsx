import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync profile details with API on mount if token is found
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('safenet_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/api/user/profile');
        setUser(res.data);
      } catch (err) {
        console.error('Session authentication restore failed:', err.parsedMessage);
        localStorage.removeItem('safenet_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Login handler
  const login = async (email, password) => {
    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { token, user: userData } = res.data;
      
      localStorage.setItem('safenet_token', token);
      setUser(userData);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.parsedMessage || 'Invalid email or password.' };
    }
  };

  // Registration handler
  const register = async (name, phone, email, password) => {
    try {
      const res = await api.post('/api/auth/register', { name, phone, email, password });
      const { token, user: userData } = res.data;

      localStorage.setItem('safenet_token', token);
      setUser(userData);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.parsedMessage || 'Registration failed.' };
    }
  };

  // Profile refresh helper
  const refreshProfile = async () => {
    try {
      const res = await api.get('/api/user/profile');
      setUser(res.data);
    } catch (err) {
      console.error('Profile refresh failure:', err);
    }
  };

  // Update emergency message helper
  const updateEmergencyMessage = async (message) => {
    try {
      const res = await api.put('/api/user/message', { emergencyMessage: message });
      setUser((prev) => prev ? { ...prev, emergencyMessage: res.data.emergencyMessage } : null);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.parsedMessage || 'Failed to update message.' };
    }
  };

  // Update trusted contacts list
  const updateTrustedContacts = async (contactsList) => {
    try {
      const res = await api.put('/api/user/contacts', { contacts: contactsList });
      setUser((prev) => prev ? { ...prev, trustedContacts: res.data.trustedContacts } : null);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.parsedMessage || 'Failed to update contacts.' };
    }
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem('safenet_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateEmergencyMessage,
        updateTrustedContacts,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be executed within an AuthProvider.');
  }
  return context;
};
