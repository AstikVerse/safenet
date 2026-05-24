import { useState, useEffect, useCallback } from 'react';

const useGeolocation = (options = {}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState({ lat: 28.6139, lng: 77.2090 }); // Default: New Delhi as realistic fallback

  const handleSuccess = useCallback((position) => {
    setLocation({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    });
    setLoading(false);
    setError(null);
  }, []);

  const handleError = useCallback((err) => {
    console.warn(`Geolocation error code (${err.code}): ${err.message}. Using default mock location.`);
    setError(err.message);
    setLoading(false);
    
    // In local developer mode, let's fuzz the default coordinate slightly so that mock triggers don't look completely static!
    const randomOffsetLat = (Math.random() - 0.5) * 0.005;
    const randomOffsetLng = (Math.random() - 0.5) * 0.005;
    setLocation({
      lat: 28.6139 + randomOffsetLat,
      lng: 77.2090 + randomOffsetLng
    });
  }, []);

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      ...options
    });
  }, [handleSuccess, handleError, options]);

  useEffect(() => {
    getPosition();
  }, []);

  return { location, loading, error, refresh: getPosition };
};

export default useGeolocation;
