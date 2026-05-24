import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api.js';

export const useCheckin = () => {
  const [activeCheckin, setActiveCheckin] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0); // in seconds
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  // Sync / fetch active check-in from database
  const syncActiveCheckin = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/checkin/active');
      if (res.data.active) {
        const checkinData = res.data.checkIn;
        setActiveCheckin(checkinData);

        // Calculate time remaining in seconds
        const expiresAt = new Date(checkinData.expiresAt).getTime();
        const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        setTimeRemaining(diff);
      } else {
        setActiveCheckin(null);
        setTimeRemaining(0);
      }
    } catch (err) {
      console.error('Error syncing active check-in:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll server for active check-in status on mount
  useEffect(() => {
    syncActiveCheckin();
  }, [syncActiveCheckin]);

  // Manage countdown timer interval
  useEffect(() => {
    if (!activeCheckin || timeRemaining <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          syncActiveCheckin(); // Refresh status (should now be triggered)
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCheckin, timeRemaining, syncActiveCheckin]);

  // Start journey handler
  const startCheckin = async (durationMinutes, lat, lng) => {
    try {
      const res = await api.post('/api/checkin/start', { durationMinutes, lat, lng });
      const checkinData = res.data.checkIn;
      setActiveCheckin(checkinData);
      
      const expiresAt = new Date(checkinData.expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeRemaining(diff);
      return { success: true, checkIn: checkinData };
    } catch (err) {
      return { success: false, error: err.parsedMessage || 'Failed to start journey checkin.' };
    }
  };

  // Safe check-in cancel/resolve handler
  const markSafe = async () => {
    if (!activeCheckin) return { success: false, error: 'No active check-in journey found.' };
    try {
      const res = await api.patch(`/api/checkin/${activeCheckin._id}/safe`);
      setActiveCheckin(null);
      setTimeRemaining(0);
      return { success: true, checkIn: res.data.checkIn };
    } catch (err) {
      return { success: false, error: err.parsedMessage || 'Failed to complete check-in.' };
    }
  };

  // Periodic location stream for active check-ins
  const updateCheckinLocation = async (lat, lng) => {
    if (!activeCheckin) return;
    try {
      await api.patch(`/api/checkin/${activeCheckin._id}/location`, { lat, lng });
    } catch (err) {
      console.warn('Check-in location sync error:', err.parsedMessage);
    }
  };

  return {
    activeCheckin,
    timeRemaining,
    loading,
    startCheckin,
    markSafe,
    updateCheckinLocation,
    syncActiveCheckin
  };
};
export default useCheckin;
