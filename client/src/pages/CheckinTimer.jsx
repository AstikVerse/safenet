import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { ChevronLeft, ShieldCheck, Clock, Users, ShieldAlert, Award, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCheckin } from '../hooks/useCheckin.js';
import useGeolocation from '../hooks/useGeolocation.js';
import { formatCountdown } from '../utils/formatters.js';

// Setup default marker icon for Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CheckinTimer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { location: geoCoords, refresh: refreshGeo } = useGeolocation();
  const { activeCheckin, timeRemaining, startCheckin, markSafe, updateCheckinLocation } = useCheckin();

  // Screen Form States
  const [duration, setDuration] = useState(15); // in minutes
  const [customDuration, setCustomDuration] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Wake Lock Ref
  const wakeLockRef = useRef(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // Sync contacts check-boxes with user profile contacts on load
  useEffect(() => {
    if (user?.trustedContacts) {
      setSelectedContacts(user.trustedContacts.map(c => c.email));
    }
  }, [user]);

  // Request Wake Lock on active check-in journey
  useEffect(() => {
    const acquireWakeLock = async () => {
      if (activeCheckin && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          setWakeLockActive(true);
          console.log('🔒 Screen Wake Lock activated.');
        } catch (err) {
          console.warn('Wake Lock request failure:', err.message);
        }
      }
    };

    acquireWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        setWakeLockActive(false);
        console.log('🔓 Screen Wake Lock released.');
      }
    };
  }, [activeCheckin]);

  // Periodic coordinates push to MERN database during active countdown
  useEffect(() => {
    let syncInterval = null;
    if (activeCheckin) {
      syncInterval = setInterval(() => {
        refreshGeo();
        updateCheckinLocation(geoCoords.lat, geoCoords.lng);
      }, 15000); // Sync location coordinates every 15 seconds
    }
    return () => {
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [activeCheckin, geoCoords, refreshGeo, updateCheckinLocation]);

  const handleContactToggle = (email) => {
    setSelectedContacts((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const handleStart = async () => {
    setErrorMsg('');
    const finalDuration = customDuration ? parseInt(customDuration) : duration;
    
    if (isNaN(finalDuration) || finalDuration <= 0) {
      setErrorMsg('Please select or specify a valid journey duration.');
      return;
    }

    if (selectedContacts.length === 0) {
      setErrorMsg('Please select at least 1 contact to alert in case of emergency.');
      return;
    }

    setSubmitting(true);
    refreshGeo();
    
    const res = await startCheckin(finalDuration, geoCoords.lat, geoCoords.lng);
    setSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error);
    }
  };

  const handleSafe = async () => {
    setSubmitting(true);
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    
    const res = await markSafe();
    setSubmitting(false);
    
    if (res.success) {
      alert('Journey completed! We are glad you got home safe.');
      navigate('/home');
    } else {
      alert(res.error);
    }
  };

  // SVG circular properties
  const radius = 80;
  const circumference = 2 * Math.PI * radius; // ~502.65
  const totalDuration = activeCheckin ? activeCheckin.durationMinutes * 60 : 1;
  const strokeOffset = activeCheckin
    ? ((totalDuration - timeRemaining) / totalDuration) * circumference
    : 0;

  // Percentage left
  const pct = timeRemaining / totalDuration;
  
  // Ring colors shifting green -> amber -> red
  let ringColor = '#14B8A6'; // Green
  if (pct <= 0.15) {
    ringColor = '#F43F5E'; // Red
  } else if (pct <= 0.5) {
    ringColor = '#F59E0B'; // Amber/Yellow
  }

  return (
    <div className="phone-container page-transition bg-background-warm pb-8">
      
      {/* Header bar */}
      <header className="w-full bg-white border-b border-border-soft px-6 py-5 flex items-center justify-between shadow-soft">
        <button
          onClick={() => navigate('/home')}
          className="p-2 -ml-2 rounded-full hover:bg-background-warm text-dark-body interactive-transition"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-base font-bold text-dark-heading">Safe Check-in</h2>
        <div className="w-8" /> {/* spacer */}
      </header>

      <main className="flex-1 p-6 flex flex-col gap-6">
        
        {/* State A: Start Checkin Form */}
        {!activeCheckin && (
          <div className="flex flex-col gap-5 animate-fade-in-up">
            
            {/* Page info card */}
            <div className="bg-white border border-border-soft rounded-2xl p-5 shadow-card">
              <h3 className="text-sm font-bold text-dark-heading flex items-center gap-2">
                <Clock size={18} className="text-secondary" />
                <span>How Check-in Works</span>
              </h3>
              <p className="text-xs text-dark-body mt-2 leading-relaxed">
                Set a duration for your walk or trip. If you don't mark yourself as <strong>"Safe"</strong> before the timer expires, an automated emergency email will be sent to your selected contacts detailing your last known GPS coordinate.
              </p>
            </div>

            {errorMsg && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-primary text-xs leading-relaxed">
                {errorMsg}
              </div>
            )}

            {/* Duration Selector cards */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-bold text-dark-heading tracking-wider">SELECT JOURNEY DURATION</label>
              <div className="grid grid-cols-5 gap-2">
                {[15, 30, 45, 60, 90].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setDuration(t);
                      setCustomDuration('');
                    }}
                    className={`py-2.5 text-xs font-bold rounded-full border interactive-transition ${
                      duration === t && !customDuration
                        ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                        : 'bg-white text-dark-body border-border-soft hover:bg-background-warm'
                    }`}
                  >
                    {t}m
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div className="relative mt-1">
                <input
                  type="number"
                  value={customDuration}
                  onChange={(e) => {
                    setCustomDuration(e.target.value);
                    setDuration(0);
                  }}
                  placeholder="Or enter custom minutes"
                  className="w-full bg-white border border-border-soft focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-xs text-dark-body outline-none interactive-transition pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-dark-muted">min</span>
              </div>
            </div>

            {/* Trusted Contacts checkbox list */}
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-bold text-dark-heading tracking-wider">NOTIFY CONTACTS ON EXPIRE</label>
              {(!user?.trustedContacts || user.trustedContacts.length === 0) ? (
                <div className="bg-white border border-border-soft rounded-xl p-4 text-center">
                  <p className="text-xs text-dark-muted">You haven't added any trusted contacts yet.</p>
                  <button
                    onClick={() => navigate('/profile')}
                    className="text-xs font-semibold text-primary hover:text-primary-hover underline mt-2"
                  >
                    Add contacts now
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-border-soft rounded-2xl p-4 flex flex-col gap-3 shadow-card max-h-[220px] overflow-y-auto">
                  {user.trustedContacts.map((contact) => (
                    <label
                      key={contact.email}
                      className="flex items-center justify-between border-b border-border-soft/40 pb-2.5 last:border-b-0 last:pb-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary-light flex items-center justify-center text-xs font-bold text-secondary">
                          {contact.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-dark-heading">{contact.name}</p>
                          <p className="text-[10px] text-dark-muted mt-0.5">{contact.phone}</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(contact.email)}
                        onChange={() => handleContactToggle(contact.email)}
                        className="w-4.5 h-4.5 text-primary focus:ring-primary border-border-soft rounded accent-primary cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Trigger */}
            <button
              onClick={handleStart}
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-bold py-4 rounded-full shadow-lg shadow-primary/20 interactive-transition mt-3 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Award size={18} />
                  <span>Start Journey Check-in</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* State B: Active Checkin countdown UI */}
        {activeCheckin && (
          <div className="flex flex-col items-center gap-6 animate-fade-in-up w-full">
            
            {/* Wake Lock Active Badge */}
            {wakeLockActive && (
              <div className="bg-accent-light border border-accent/20 rounded-full px-3 py-1 flex items-center gap-1.5 text-[11px] font-bold text-accent tracking-wide uppercase">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-ping" />
                <span>Screen Wake Lock: Active</span>
              </div>
            )}

            {/* Countdown SVG Circle progress */}
            <div className="relative w-56 h-56 flex items-center justify-center">
              
              <svg className="absolute w-full h-full transform -rotate-90">
                {/* Backing Ring */}
                <circle
                  cx="112"
                  cy="112"
                  r={radius}
                  fill="transparent"
                  stroke="#F1D5D8"
                  strokeWidth="8"
                />
                {/* Fronting Active Progress */}
                <circle
                  cx="112"
                  cy="112"
                  r={radius}
                  fill="transparent"
                  stroke={ringColor}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  className="svg-progress-circle"
                />
              </svg>

              {/* Time displays */}
              <div className="flex flex-col items-center justify-center relative z-20">
                <span className="text-3xl font-extrabold text-dark-heading tracking-tight">
                  {formatCountdown(timeRemaining)}
                </span>
                <span className="text-[11px] font-bold text-dark-muted tracking-wider uppercase mt-1">
                  Remaining
                </span>
              </div>
            </div>

            {/* Alert warnings if running low */}
            {pct <= 0.15 && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-start gap-2.5 text-primary text-xs leading-relaxed max-w-[340px] animate-pulse">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <span>Warning: Time is running out. Please tap "I am safe" or your contacts will be sent coordinates immediately.</span>
              </div>
            )}

            {/* Leaflet small GPS thumbnail map */}
            <div className="w-full flex flex-col gap-2">
              <label className="text-xs font-bold text-dark-heading tracking-wider flex items-center gap-1.5">
                <MapPin size={14} className="text-primary" />
                <span>LAST KNOWN GPS LOCATION</span>
              </label>
              
              <div className="w-full h-40 border border-border-soft rounded-2xl overflow-hidden shadow-sm relative">
                {geoCoords && (
                  <MapContainer
                    center={[geoCoords.lat, geoCoords.lng]}
                    zoom={15}
                    scrollWheelZoom={false}
                    zoomControl={false}
                    attributionControl={false}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    />
                    <Marker position={[geoCoords.lat, geoCoords.lng]} />
                  </MapContainer>
                )}
              </div>
              <p className="text-[10px] text-dark-muted font-medium text-center mt-1">
                Updating coordinates and saving GPS logs to cloud every 15 seconds...
              </p>
            </div>

            {/* I am Safe Cancellation Button */}
            <button
              onClick={handleSafe}
              disabled={submitting}
              className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-4 rounded-full shadow-safe interactive-transition mt-4 flex items-center justify-center gap-2 animate-scale-bounce"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={22} />
                  <span>I'm Safe (Stop Countdown)</span>
                </>
              )}
            </button>
          </div>
        )}

      </main>
    </div>
  );
};

export default CheckinTimer;
