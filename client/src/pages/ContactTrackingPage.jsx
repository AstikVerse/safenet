import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';
import { ShieldAlert, Phone, AlertCircle, Calendar, MessageSquare, Clock } from 'lucide-react';
import api from '../utils/api.js';
import { formatFullDateTime } from '../utils/formatters.js';

// Setup Map Center ref updater component to pan maps automatically
const MapCenterUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.panTo(center, { animate: true, duration: 1 });
    }
  }, [center, map]);
  return null;
};

const ContactTrackingPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Tracking details state
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Real-time location parameters
  const [currentCoords, setCurrentCoords] = useState(null);
  const [historyTrail, setHistoryTrail] = useState([]);
  const [status, setStatus] = useState('active');

  const socketRef = useRef(null);

  // 1. Fetch initial tracking profile coordinates from secure token-auth API
  useEffect(() => {
    const fetchTrackingSession = async () => {
      if (!id || !token) {
        setErrorMsg('Invalid tracking link. Token signature is missing.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await api.get(`/api/panic/${id}/track?token=${token}`);
        const data = res.data;

        setTrackingData(data);
        setCurrentCoords(data.location);
        setHistoryTrail(data.locationHistory.map((pt) => [pt.lat, pt.lng]));
        setStatus(data.status);
      } catch (err) {
        setErrorMsg(err.parsedMessage || 'Access Denied. Tracking token has expired or is invalid.');
      } finally {
        setLoading(false);
      }
    };

    fetchTrackingSession();
  }, [id, token]);

  // 2. Establish separate Socket connection and join the panic tracking room
  useEffect(() => {
    if (loading || errorMsg || !id || !token || status === 'resolved') return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socketInstance = io(socketUrl, {
      autoConnect: true,
      reconnection: true
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      console.log('🔌 Socket: Connected for observer tracking room');
      // Join panic room
      socketInstance.emit('join-panic-room', { panicId: id, token });
    });

    // Handle incoming real-time location stream changes from the user
    socketInstance.on('location-changed', ({ lat, lng, timestamp }) => {
      console.log('🔌 Socket Update: Location coordinates shifted:', lat, lng);
      
      const newPos = { lat, lng };
      setCurrentCoords(newPos);
      
      setHistoryTrail((prev) => {
        const nextTrail = [...prev, [lat, lng]];
        // Keep only last 10 trail coordinates for polyline path render
        return nextTrail.slice(-10);
      });
    });

    // Handle panic resolution trigger from the user
    socketInstance.on('panic-resolved', ({ resolvedAt }) => {
      console.log('🔌 Socket Update: Panic resolved.');
      setStatus('resolved');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    });

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [id, token, loading, errorMsg, status]);

  // Handle map marker styles for user tracking
  const createPulseMarker = () => {
    const color = status === 'resolved' ? '#14B8A6' : '#F43F5E';
    return L.divIcon({
      html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px ${color};" class="${status === 'resolved' ? '' : 'animate-ping'}"></div>`,
      className: 'tracking-pulse-marker',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
  };

  if (loading) {
    return (
      <div className="phone-container bg-background-warm flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-dark-muted uppercase tracking-wider">Establishing GPS Stream...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="phone-container bg-background-warm flex items-center justify-center p-8">
        <div className="bg-white border border-border-soft rounded-2xl p-6 shadow-card flex flex-col items-center text-center gap-4 animate-fade-in-up">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <AlertCircle size={28} />
          </div>
          <h3 className="text-base font-bold text-dark-heading">Emergency Access Denied</h3>
          <p className="text-xs text-dark-body leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary hover:bg-primary-hover text-white text-xs font-bold py-2.5 px-6 rounded-full shadow-md interactive-transition mt-2"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-container bg-background-warm pb-8 page-transition flex flex-col justify-between">
      
      {/* Top emergency status headers */}
      <header className="w-full bg-white border-b border-border-soft p-5 shadow-soft z-20 flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-primary-light rounded-full flex items-center justify-center text-primary shrink-0 animate-pulse">
            <ShieldAlert size={18} />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-dark-heading leading-tight">
              {trackingData?.userName} Emergency Tracking
            </h2>
            <span className="text-[10px] font-bold text-primary tracking-wider uppercase">
              {status === 'resolved' ? '⚠️ Session Concluded (Safe)' : '🚨 Live Coordinates Stream Active'}
            </span>
          </div>
        </div>

        {/* Resolved Alert Banner */}
        {status === 'resolved' && (
          <div className="bg-accent-light border border-accent/25 rounded-xl p-3 flex items-start gap-2 text-accent text-xs mt-1 animate-fade-in-up">
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
            <span className="font-semibold leading-relaxed">Great news! {trackingData?.userName} has marked themselves as Safe. The emergency alert has been resolved.</span>
          </div>
        )}
      </header>

      {/* Main Map tracking zone */}
      <main className="flex-1 relative z-10 w-full min-h-[380px] bg-border-soft/25">
        {currentCoords && (
          <MapContainer
            center={[currentCoords.lat, currentCoords.lng]}
            zoom={16}
            style={{ width: '100%', height: '100%', minHeight: '380px' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />

            {/* Polyline location history path trail */}
            {historyTrail.length > 1 && (
              <Polyline
                positions={historyTrail}
                color="#F43F5E"
                weight={3}
                opacity={0.8}
                dashArray="5, 10"
              />
            )}

            {/* Live user coordinates Marker */}
            <Marker position={[currentCoords.lat, currentCoords.lng]} icon={createPulseMarker()} />

            {/* Auto update center */}
            <MapCenterUpdater center={[currentCoords.lat, currentCoords.lng]} />
          </MapContainer>
        )}
      </main>

      {/* Bottom Emergency Meta details & dial prompts */}
      <section className="bg-white border-t border-border-soft p-5 shadow-lg z-20 flex flex-col gap-4">
        
        {/* Detail rows */}
        <div className="flex flex-col gap-2.5 bg-background-warm rounded-2xl p-4 border border-border-soft/60">
          <div className="flex items-start gap-2.5 text-xs text-dark-body">
            <MessageSquare size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-dark-heading block">Emergency SMS Message:</span>
              <p className="italic mt-0.5 text-dark-body">"{trackingData?.emergencyMessage}"</p>
            </div>
          </div>
          <div className="w-full border-t border-border-soft/40 my-1" />
          <div className="flex items-center gap-2.5 text-xs text-dark-body">
            <Calendar size={16} className="text-secondary shrink-0" />
            <div>
              <span className="font-semibold text-dark-heading">Activated At:</span>
              <span className="ml-1 text-dark-body font-semibold">{formatFullDateTime(trackingData?.triggeredAt)}</span>
            </div>
          </div>
        </div>

        {/* Action Quick Call button */}
        <a
          href={`tel:${trackingData?.userPhone}`}
          className="w-full bg-primary hover:bg-primary-hover text-white text-base font-bold py-4 rounded-full shadow-lg shadow-primary/20 flex items-center justify-center gap-2.5 interactive-transition"
        >
          <Phone size={18} />
          <span>Call {trackingData?.userName} now</span>
        </a>
      </section>
    </div>
  );
};

export default ContactTrackingPage;
