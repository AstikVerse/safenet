import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Shield, ShieldAlert, ArrowRight, ShieldCheck, Heart, Users, MapPin, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import useGeolocation from '../hooks/useGeolocation.js';
import useCheckin from '../hooks/useCheckin.js';
import api from '../utils/api.js';
import BottomNav from '../components/BottomNav.jsx';

// Custom policeman SVG icon (combining a police officer's hat and badge silhouette)
const PoliceIcon = ({ size = 20, className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
  >
    {/* Cap visor and base shape */}
    <path d="M12 2C8.5 2 6 3.5 5 5h14c-1-1.5-3-3-7-3zm10 8.5c0-3-2.5-5.5-10-5.5S2 7.5 2 10.5c0 .3.1.6.2.8L4 13h16l1.8-1.7c.1-.2.2-.5.2-.8zM3 14h18v2H3v-2zm3 3h12l-1 4H7l-1-4z" />
    {/* Center star badge */}
    <path d="M12 9a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z" />
  </svg>
);

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { joinRoom, sendLocationUpdate, resolvePanicSocket } = useSocket();
  const { location: geoCoords, refresh: refreshGeo } = useGeolocation();
  const { activeCheckin } = useCheckin();

  // Press-to-SOS long press state variables
  const [progress, setProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  
  // Panic event active session states
  const [panicEvent, setPanicEvent] = useState(null); // stores active panic event document info
  const [panicStatus, setPanicStatus] = useState('idle'); // idle | triggered | active | resolving
  const [flashScreen, setFlashScreen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const holdTimer = useRef(null);
  const gpsInterval = useRef(null);
  const pressAudio = useRef(null);

  // Sync active panic status on mount just in case
  useEffect(() => {
    // If a panic was active locally, we can let them resolve it
    const localPanicId = localStorage.getItem('safenet_active_panic_id');
    const localPanicToken = localStorage.getItem('safenet_active_panic_token');
    const localQuotaExceeded = localStorage.getItem('safenet_active_panic_quota_exceeded') === 'true';
    if (localPanicId && localPanicToken) {
      setPanicStatus('active');
      setPanicEvent({ id: localPanicId, token: localPanicToken });
      setQuotaExceeded(localQuotaExceeded);
      joinRoom(localPanicId, localPanicToken);
    }
  }, [joinRoom]);

  // Active Location stream interval for active panic tracking
  useEffect(() => {
    if (panicStatus === 'active' && panicEvent?.id) {
      // 1. Instantly trigger location update
      refreshGeo();
      sendLocationUpdate(panicEvent.id, geoCoords.lat, geoCoords.lng);

      // 2. Stream coordinates every 5 seconds
      gpsInterval.current = setInterval(async () => {
        refreshGeo();
        
        // Push update to DB
        try {
          await api.patch(`/api/panic/${panicEvent.id}/location`, {
            lat: geoCoords.lat,
            lng: geoCoords.lng
          });
          // Broadcast coordinate shift to observers via WebSocket
          sendLocationUpdate(panicEvent.id, geoCoords.lat, geoCoords.lng);
        } catch (err) {
          console.warn('Live tracking update failure:', err.message);
        }
      }, 5000);
    } else {
      if (gpsInterval.current) {
        clearInterval(gpsInterval.current);
        gpsInterval.current = null;
      }
    }

    return () => {
      if (gpsInterval.current) clearInterval(gpsInterval.current);
    };
  }, [panicStatus, panicEvent, geoCoords, sendLocationUpdate, refreshGeo]);

  // Press triggers
  const handleStartPress = (e) => {
    e.preventDefault();
    if (panicStatus !== 'idle') return;

    setIsPressing(true);
    setProgress(0);

    // Play subtle haptic feedback vibe if navigator vibrates
    if (navigator.vibrate) {
      navigator.vibrate(60);
    }

    const startTime = Date.now();
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / 2000) * 100);
      setProgress(pct);

      if (elapsed >= 2000) {
        clearInterval(holdTimer.current);
        holdTimer.current = null;
        triggerPanicEvent();
      }
    }, 40);
  };

  const handleEndPress = () => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
    setIsPressing(false);
    setProgress(0);
  };

  // Trigger MERN SOS alerts
  const triggerPanicEvent = async () => {
    setPanicStatus('triggered');
    setFlashScreen(true);

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }

    // Turn off red screen flash after 300ms
    setTimeout(() => {
      setFlashScreen(false);
    }, 300);

    try {
      refreshGeo();
      const res = await api.post('/api/panic/trigger', {
        lat: geoCoords.lat,
        lng: geoCoords.lng
      });

      const { panicEventId, trackingToken, emailQuotaExceeded } = res.data;
      
      const newPanic = { id: panicEventId, token: trackingToken };
      setPanicEvent(newPanic);
      setQuotaExceeded(!!emailQuotaExceeded);
      setPanicStatus('active');

      if (emailQuotaExceeded) {
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
        }, 6000);
      }

      // Persist locally so page reloads don't lose emergency tracking
      localStorage.setItem('safenet_active_panic_id', panicEventId);
      localStorage.setItem('safenet_active_panic_token', trackingToken);
      localStorage.setItem('safenet_active_panic_quota_exceeded', !!emailQuotaExceeded);

      // Join WebSocket tracking room
      joinRoom(panicEventId, trackingToken);

    } catch (error) {
      console.error('Trigger panic backend error:', error);
      alert('Alert created locally, but failed to connect to emergency dispatch server. Please call emergency services.');
      setPanicStatus('idle');
    }
  };

  // Resolve active SOS alert
  const handleResolvePanic = async () => {
    if (!panicEvent?.id) return;
    setPanicStatus('resolving');

    try {
      await api.post(`/api/panic/${panicEvent.id}/resolve`);
      
      // Close WebSockets room
      resolvePanicSocket(panicEvent.id);

      // Wipe local storage keys
      localStorage.removeItem('safenet_active_panic_id');
      localStorage.removeItem('safenet_active_panic_token');
      localStorage.removeItem('safenet_active_panic_quota_exceeded');

      setPanicEvent(null);
      setPanicStatus('idle');
      setQuotaExceeded(false);
      setProgress(0);
      setIsPressing(false);

      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch (error) {
      console.error('Resolve panic backend failure:', error);
      alert('Unable to close tracking session on the cloud. Force resetting dashboard.');
      
      localStorage.removeItem('safenet_active_panic_id');
      localStorage.removeItem('safenet_active_panic_token');
      localStorage.removeItem('safenet_active_panic_quota_exceeded');
      setPanicEvent(null);
      setPanicStatus('idle');
      setQuotaExceeded(false);
    }
  };

  return (
    <div className="phone-container page-transition bg-background-warm pb-24 relative">
      
      {/* 200ms Red Flash overlay */}
      {flashScreen && (
        <div className="absolute inset-0 bg-primary z-50 animate-ping duration-300" style={{ mixBlendMode: 'multiply' }} />
      )}

      {/* Top Header Navigation bar */}
      <header className="w-full bg-white border-b border-border-soft px-6 py-5 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center border border-primary/10">
            <Shield size={20} className="text-primary font-bold" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-dark-muted tracking-wider uppercase leading-none">SafeNet Network</p>
            <h2 className="text-lg font-bold text-dark-heading leading-tight mt-1">Hi, {user?.name || 'User'}</h2>
          </div>
        </div>
        <button
          onClick={() => navigate('/profile')}
          className="p-2.5 rounded-full hover:bg-background-warm text-dark-body interactive-transition border border-border-soft/60"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* Main SOS Panic controller section */}
      <main className="flex-1 flex flex-col justify-center items-center px-6 py-8">
        
        {panicStatus === 'idle' && (
          <div className="flex flex-col items-center justify-center w-full">
            
            {/* Pulsing ring wrapper around Panic SOS trigger */}
            <div className="relative w-72 h-72 flex items-center justify-center mb-8">
              
              {/* Backing Ring Pulse scale */}
              <div className={`absolute inset-0 rounded-full bg-primary/10 border border-primary/20 interactive-transition ${isPressing ? 'scale-110 opacity-40 bg-primary/30 animate-pulse' : 'animate-pulse-ring'}`} />
              <div className={`absolute inset-6 rounded-full bg-primary/20 interactive-transition ${isPressing ? 'scale-105 opacity-60 bg-primary/40' : 'animate-pulse-ring'}`} style={{ animationDelay: '0.6s' }} />

              {/* Charging Outer SVG Progress Halo (Visible when pressing) */}
              {isPressing && (
                <svg className="absolute w-64 h-64 transform -rotate-90 z-20 pointer-events-none">
                  <circle
                    cx="128"
                    cy="128"
                    r="112"
                    fill="transparent"
                    stroke="#FFF1F2"
                    strokeWidth="6"
                  />
                  <circle
                    cx="128"
                    cy="128"
                    r="112"
                    fill="transparent"
                    stroke="#F43F5E"
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 112}
                    strokeDashoffset={2 * Math.PI * 112 - (progress / 100) * (2 * Math.PI * 112)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 40ms linear' }}
                  />
                </svg>
              )}

              {/* Central Trigger Button */}
              <button
                onMouseDown={handleStartPress}
                onMouseUp={handleEndPress}
                onMouseLeave={handleEndPress}
                onTouchStart={handleStartPress}
                onTouchEnd={handleEndPress}
                className="absolute w-52 h-52 bg-primary rounded-full flex flex-col items-center justify-center shadow-lg shadow-primary/30 border-4 border-white cursor-pointer select-none active:scale-95 active:shadow-md interactive-transition z-10 overflow-hidden"
              >
                
                {/* Hold Circular Fill overlay */}
                {isPressing && (
                  <div
                    className="absolute inset-0 bg-primary-hover/30 scale-105 interactive-transition"
                    style={{
                      transform: `scale(${progress / 100})`,
                      opacity: 0.4,
                      borderRadius: '50%',
                      transition: 'transform 40ms linear'
                    }}
                  />
                )}

                <ShieldAlert size={56} className="text-white relative z-20" />
                <span className="text-white font-bold text-lg tracking-wide mt-3 relative z-20">
                  {isPressing ? 'Holding...' : 'Hold for SOS'}
                </span>
                <span className="text-white/80 font-medium text-[11px] tracking-wider uppercase mt-1 relative z-20">
                  {isPressing ? `${Math.floor(progress)}%` : 'Press 2 Seconds'}
                </span>
              </button>
            </div>

            <p className="text-xs text-dark-muted font-semibold tracking-wide text-center max-w-[280px] leading-relaxed">
              * Holds prevent accidental alerts. Activating notifies trusted contacts with live tracking.
            </p>
          </div>

        )}

        {/* SOS Panic Triggered/Active confirmation card */}
        {(panicStatus === 'active' || panicStatus === 'triggered' || panicStatus === 'resolving') && (
          <div className="w-full bg-white border-2 border-primary/30 rounded-2xl p-6 shadow-xl shadow-primary/5 flex flex-col items-center text-center animate-fade-in-up">
            
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20 mb-4 animate-bounce">
              <ShieldAlert size={32} className="text-white" />
            </div>

            <h3 className="text-xl font-bold text-primary">Emergency SOS Activated</h3>
            
            {quotaExceeded ? (
              <div className="bg-rose-50 border border-primary/25 rounded-xl p-3.5 text-left flex flex-col gap-1.5 mt-4 mb-2 w-full animate-pulse-ring">
                <span className="text-[10px] font-black text-primary tracking-wider uppercase leading-none">⚠️ Email Quota Active</span>
                <p className="text-[11px] text-primary font-medium leading-relaxed mt-0.5">
                  Daily emergency alert limit reached (3/3). Local tools remain fully functional, but outbound emails to contacts are blocked. Try again tomorrow or call 112 directly if this is a real emergency.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-dark-body mt-2 leading-relaxed max-w-[280px]">
                  Trusted contacts and safety rooms have been alerted. Streaming live location.
                </p>
                {/* Success Quota reminder card */}
                <div className="bg-background-warm border border-border-soft rounded-xl px-4 py-2 mt-3.5 w-full text-center">
                  <span className="text-[9px] font-bold text-dark-muted tracking-wider uppercase">
                    Quota Used: {Math.min(3, user?.trustedContacts?.length || 0)}/3 credits this session.
                  </span>
                </div>
              </>
            )}

            <div className="w-full border-t border-border-soft/60 my-5" />

            <ul className="w-full flex flex-col gap-3.5 mb-6 text-left">
              <li className="flex items-center gap-3 text-xs font-semibold text-dark-body bg-primary-light/50 border border-primary/10 rounded-xl px-4 py-3">
                <Heart size={16} className="text-primary shrink-0" />
                <span>
                  {quotaExceeded 
                    ? "Outbound Emails Blocked (Quota Exceeded)" 
                    : `${user?.trustedContacts?.length || 0} Trusted Contacts Notified`}
                </span>
              </li>
              <li className="flex items-center gap-3 text-xs font-semibold text-dark-body bg-primary-light/50 border border-primary/10 rounded-xl px-4 py-3">
                <MapPin size={16} className="text-primary shrink-0" />
                <span>Live Coordinates Stream: lat: {geoCoords.lat.toFixed(4)}, lng: {geoCoords.lng.toFixed(4)}</span>
              </li>
            </ul>

            {/* Premium Zero-Cost Native WhatsApp and Carrier SMS triggers (Side-by-Side) */}
            {panicEvent?.id && (
              <div className="w-full flex gap-3 mb-4 animate-fade-in-up">
                
                {/* 1. Direct WhatsApp Share (Universal wa.me shortcut) */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `🚨 SafeNet EMERGENCY ALERT! ${user?.name} needs help! Emergency Message: "${user?.emergencyMessage || 'I need help. This is my live location.'}". Track my live GPS coordinates here: ${window.location.origin}/track/${panicEvent.id}?token=${panicEvent.token}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-3 rounded-xl shadow-sm flex items-center justify-center gap-1.5 text-xs interactive-transition"
                >
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.024-.014-.508-.25-5.887-.29c-.347-.116-.547-.196-.747.04-.199.237-.778.978-.95 1.17-.177.195-.355.21-.497.129-.14-.08-1.597-.58-3.043-1.87-1.122-.998-1.879-2.23-2.1-2.614-.22-.38-.024-.589.176-.787.18-.18.397-.46.596-.69.198-.22.264-.38.397-.648.132-.27.066-.502-.033-.7-.099-.197-.777-1.867-1.07-2.572-.284-.694-.572-.6-.787-.6-.213-.01-.458-.01-.703-.01-.244 0-.643.09-.978.47-.336.375-1.287 1.258-1.287 3.07 0 1.81 1.32 3.56 1.503 3.8.183.24 2.59 3.96 6.273 5.55 3.682 1.59 3.682 1.06 4.346.997.666-.063 2.147-.878 2.45-1.728.303-.85.303-1.57.213-1.73-.092-.16-.336-.25-.6-.388zM12 .002C5.378.002.001 5.378.001 12c0 2.112.55 4.168 1.59 5.97L.002 24l6.19-.1.624.32C8.618 23.47 10.28 24 12 24c6.623 0 12-5.377 12-12s-5.377-11.998-12-11.998z"/>
                  </svg>
                  <span>WhatsApp</span>
                </a>

                {/* 2. Direct Mobile Carrier SMS */}
                <a
                  href={`sms:?body=${encodeURIComponent(
                    `🚨 SafeNet EMERGENCY ALERT! ${user?.name} needs help! Emergency Message: "${user?.emergencyMessage || 'I need help. This is my live location.'}". Track my live GPS coordinates here: ${window.location.origin}/track/${panicEvent.id}?token=${panicEvent.token}`
                  )}`}
                  className="flex-1 bg-[#1A1A2E] hover:bg-black text-white font-bold py-3 rounded-xl shadow-sm flex items-center justify-center gap-1.5 text-xs interactive-transition border border-dark-heading/10"
                >
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
                  </svg>
                  <span>SMS Alert</span>
                </a>

              </div>
            )}

            {/* Call Police Emergency Action */}
            <a
              href="tel:112"
              className="w-full mb-3.5 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-full shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 text-sm interactive-transition border-2 border-white"
            >
              <PoliceIcon className="text-white fill-current shrink-0 animate-pulse" size={20} />
              <span>Call Police (112)</span>
            </a>

            <button
              onClick={handleResolvePanic}
              disabled={panicStatus === 'resolving'}
              className="w-full bg-accent hover:bg-accent-hover disabled:bg-accent/40 text-white font-bold py-4 rounded-full shadow-safe interactive-transition flex items-center justify-center gap-2"
            >
              {panicStatus === 'resolving' ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={20} />
                  <span>I am safe (Cancel SOS)</span>
                </>
              )}
            </button>
          </div>

        )}

        {/* Start checkin / journey navigation card */}
        {panicStatus === 'idle' && (
          <div className="w-full mt-6 bg-white border border-border-soft rounded-2xl p-5 shadow-card flex justify-between items-center hover:border-primary/20 interactive-transition">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-secondary-light rounded-xl flex items-center justify-center border border-secondary/10 shrink-0">
                <ShieldCheck size={24} className="text-secondary" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-dark-heading">
                  {activeCheckin ? 'Check-in Journey Active' : 'Start Safe Check-in'}
                </h4>
                <p className="text-xs text-dark-muted mt-1 leading-relaxed max-w-[200px]">
                  {activeCheckin ? 'A timer is counting down. Tap to manage journey.' : 'Heading home or walking alone? Start a countdown checkin.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/checkin')}
              className="p-3 rounded-full bg-secondary-light hover:bg-secondary/15 text-secondary interactive-transition border border-secondary/10 shrink-0 ml-2"
            >
              <ArrowRight size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Call Police Emergency Shortcut Block */}
        {panicStatus === 'idle' && (
          <div className="w-full mt-4 bg-rose-50 border border-rose-100 rounded-2xl p-5 shadow-card flex justify-between items-center hover:border-red-200 interactive-transition">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100/70 rounded-xl flex items-center justify-center border border-red-200/50 shrink-0">
                <PoliceIcon className="text-red-600 fill-current" size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-950">Call Police Emergency</h4>
                <p className="text-xs text-red-700 mt-1 leading-relaxed max-w-[200px]">
                  Need immediate police assistance? Tap to call emergency services.
                </p>
              </div>
            </div>
            <a
              href="tel:112"
              className="p-3 rounded-full bg-red-100 hover:bg-red-200 text-red-600 interactive-transition border border-red-200 shrink-0 ml-2"
            >
              <Phone size={18} strokeWidth={2.5} />
            </a>
          </div>
        )}

        {/* Stats card */}
        {panicStatus === 'idle' && (
          <div className="grid grid-cols-2 gap-4 w-full mt-4">
            <div className="bg-white border border-border-soft rounded-xl p-4 shadow-card flex flex-col gap-2">
              <Users size={20} className="text-primary/70" />
              <div>
                <span className="text-[11px] font-semibold text-dark-muted tracking-wider uppercase">Contacts</span>
                <p className="text-base font-bold text-dark-heading leading-tight mt-0.5">{user?.trustedContacts?.length || 0} / 5</p>
              </div>
            </div>
            <div className="bg-white border border-border-soft rounded-xl p-4 shadow-card flex flex-col gap-2">
              <ShieldCheck size={20} className="text-accent/80" />
              <div>
                <span className="text-[11px] font-semibold text-dark-muted tracking-wider uppercase">Active Check-in</span>
                <p className="text-xs font-bold text-dark-heading leading-tight mt-1 text-ellipsis overflow-hidden whitespace-nowrap">
                  {activeCheckin ? 'Active Countdown' : 'None Running'}
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Premium Slide-in bottom Toast Notification */}
      {showToast && (
        <div className="absolute bottom-28 right-4 left-4 bg-dark-heading/95 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl border border-white/10 flex items-start gap-3 z-50 animate-fade-in-up">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-primary font-black">⚠️</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <h4 className="text-xs font-bold text-white tracking-wide">Email Limit Crossed</h4>
            <p className="text-[10px] text-white/80 leading-relaxed font-semibold">
              Your daily emergency email cap is exhausted. Trusted contacts will not receive email alerts, but all local tracking tools remain active!
            </p>
          </div>
        </div>
      )}

      {/* Footer bottom navigation bar */}
      <BottomNav />
    </div>
  );
};

export default Home;
