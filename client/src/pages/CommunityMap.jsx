import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ChevronLeft, Plus, AlertTriangle, AlertOctagon, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import useGeolocation from '../hooks/useGeolocation.js';
import api from '../utils/api.js';
import BottomNav from '../components/BottomNav.jsx';

// Custom Map Bounds tracker component
const MapBoundsTracker = ({ onBoundsChange }) => {
  const map = useMapEvents({
    moveend() {
      onBoundsChange(map.getBounds());
    },
    zoomend() {
      onBoundsChange(map.getBounds());
    }
  });

  // Fetch initial bounds on mount
  useEffect(() => {
    onBoundsChange(map.getBounds());
  }, []);

  return null;
};

const CommunityMap = () => {
  const navigate = useNavigate();
  const { location: geoCoords, refresh: refreshGeo } = useGeolocation();

  // Zone Report Lists
  const [zones, setZones] = useState([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [mapBounds, setMapBounds] = useState(null);

  // Modal Control States
  const [showReportModal, setShowReportModal] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportForm, setReportForm] = useState({
    category: 'harassment',
    timeOfDay: 'evening'
  });

  // Sync / Fetch unsafe zones in the current viewport bounds
  const fetchZonesInViewport = async (bounds) => {
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    setLoadingZones(true);
    try {
      const res = await api.get(
        `/api/zones?swLat=${sw.lat}&swLng=${sw.lng}&neLat=${ne.lat}&neLng=${ne.lng}`
      );
      setZones(res.data);
    } catch (err) {
      console.warn('Error loading area reports:', err.parsedMessage);
    } finally {
      setLoadingZones(false);
    }
  };

  // Triggered when map bounds change
  useEffect(() => {
    if (mapBounds) {
      fetchZonesInViewport(mapBounds);
    }
  }, [mapBounds]);

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setSubmittingReport(true);
    refreshGeo(); // Refresh to grab active coordinates

    try {
      await api.post('/api/zones/report', {
        lat: geoCoords.lat,
        lng: geoCoords.lng,
        category: reportForm.category,
        timeOfDay: reportForm.timeOfDay
      });

      alert('Safety report submitted successfully! Coordinates fuzzed for your privacy.');
      setShowReportModal(false);
      
      // Refresh current view bounds
      if (mapBounds) {
        fetchZonesInViewport(mapBounds);
      }
    } catch (err) {
      alert(err.parsedMessage || 'Failed to submit report. Please try again.');
    } finally {
      setSubmittingReport(false);
    }
  };

  // Helper function to generate custom HTML div markers based on category colors
  const createCategoryIcon = (category) => {
    let color = '#F43F5E'; // pink = harassment
    if (category === 'theft') color = '#F59E0B'; // amber = theft
    if (category === 'stalking') color = '#8B5CF6'; // purple = stalking
    if (category === 'poor-lighting') color = '#6B7280'; // gray = poor lighting
    if (category === 'other') color = '#9CA3AF'; // gray-light = other

    return L.divIcon({
      html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.3);" class="animate-pulse"></div>`,
      className: 'custom-fuzzed-marker',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  };

  const getCategoryLabel = (cat) => {
    switch (cat) {
      case 'harassment': return 'Harassment';
      case 'theft': return 'Theft';
      case 'stalking': return 'Stalking';
      case 'poor-lighting': return 'Poor Lighting';
      default: return 'Other Hazard';
    }
  };

  return (
    <div className="phone-container page-transition bg-background-warm pb-20 relative">
      
      {/* Header element */}
      <header className="absolute top-0 left-0 right-0 w-full bg-white/95 backdrop-blur border-b border-border-soft px-6 py-4 flex items-center justify-between shadow-soft z-40">
        <button
          onClick={() => navigate('/home')}
          className="p-2 -ml-2 rounded-full hover:bg-background-warm text-dark-body interactive-transition"
        >
          <ChevronLeft size={22} />
        </button>
        <h2 className="text-base font-bold text-dark-heading flex items-center gap-1.5">
          <ShieldAlert size={18} className="text-primary" />
          <span>Community Safety Map</span>
        </h2>
        
        {/* Loading Spinner */}
        <button
          onClick={() => mapBounds && fetchZonesInViewport(mapBounds)}
          className={`p-2 rounded-full hover:bg-background-warm text-dark-body interactive-transition ${loadingZones ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={16} />
        </button>
      </header>

      {/* Full-screen Leaflet Map Container */}
      <div className="w-full flex-1 min-h-[calc(100vh-80px)] z-10 relative">
        {geoCoords && (
          <MapContainer
            center={[geoCoords.lat, geoCoords.lng]}
            zoom={14}
            zoomControl={false}
            style={{ width: '100%', height: 'calc(100vh - 80px)' }}
          >
            {/* CartoDB Positron Light Tiles */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            {/* Map Bounds tracking loop */}
            <MapBoundsTracker onBoundsChange={setMapBounds} />

            {/* Current user coordinates marker */}
            <Marker
              position={[geoCoords.lat, geoCoords.lng]}
              icon={L.divIcon({
                html: `<div style="background-color: #3B82F6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);" class="interactive-transition"></div>`,
                className: 'user-pulse-marker',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
              })}
            >
              <Popup>
                <div className="p-1 text-center font-sans">
                  <p className="text-xs font-bold text-dark-heading">Your Location</p>
                  <p className="text-[10px] text-dark-muted mt-0.5">Approximate GPS readings</p>
                </div>
              </Popup>
            </Marker>

            {/* Unsafe community zones reports markers */}
            {zones.map((zone) => (
              <Marker
                key={zone._id}
                position={[zone.location.lat, zone.location.lng]}
                icon={createCategoryIcon(zone.category)}
              >
                <Popup>
                  <div className="p-2 font-sans max-w-[180px]">
                    <span className="text-[10px] font-bold text-primary tracking-wide uppercase">Community Report</span>
                    <h4 className="text-xs font-bold text-dark-heading mt-1">{getCategoryLabel(zone.category)}</h4>
                    <p className="text-[11px] text-dark-body mt-1 leading-relaxed">
                      Occurs mostly in the <strong>{zone.timeOfDay}</strong>.
                    </p>
                    <div className="w-full border-t border-border-soft/40 my-1.5" />
                    <span className="text-[9px] text-dark-muted block">
                      Reported: {new Date(zone.reportedAt).toLocaleDateString()}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}

        {/* Legend Overlay card (bottom left) */}
        <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur border border-border-soft rounded-2xl p-4 shadow-lg z-30 max-w-[180px]">
          <h4 className="text-[11px] font-bold text-dark-heading tracking-wider uppercase mb-2">Hazard Legend</h4>
          <ul className="flex flex-col gap-1.5 text-[10px] font-semibold text-dark-body">
            <li className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F43F5E]" />
              <span>Harassment</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              <span>Theft</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
              <span>Stalking</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6B7280]" />
              <span>Poor Lighting</span>
            </li>
          </ul>
        </div>

        {/* Report FAB trigger button (bottom right) */}
        <button
          onClick={() => setShowReportModal(true)}
          className="absolute bottom-6 right-4 w-14 h-14 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 interactive-transition z-30 border-2 border-white"
        >
          <Plus size={28} />
        </button>
      </div>

      {/* Safety area reporting modal dialogue */}
      {showReportModal && (
        <div className="absolute inset-0 bg-dark-heading/40 backdrop-blur-xs flex items-end justify-center z-50 animate-fade-in-up">
          <div className="w-full max-w-[430px] bg-white rounded-t-3xl p-6 shadow-2xl border-t border-border-soft flex flex-col gap-5">
            
            {/* Modal Head */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-primary shrink-0" size={20} />
                <h3 className="text-base font-bold text-dark-heading">Report Unsafe Area</h3>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 rounded-full hover:bg-background-warm text-dark-muted interactive-transition"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-dark-body leading-relaxed -mt-2">
              Add a hazard marker to notify others. To protect your safety, your exact GPS coordinates are fuzzed by ±50 meters before saving.
            </p>

            <form onSubmit={handleReportSubmit} className="flex flex-col gap-4">
              
              {/* Category */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-dark-heading tracking-wider">HAZARD CATEGORY</label>
                <select
                  value={reportForm.category}
                  onChange={(e) => setReportForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full bg-white border border-border-soft rounded-xl px-4 py-3 text-xs text-dark-body outline-none focus:border-primary interactive-transition"
                >
                  <option value="harassment">Harassment / Catcalling</option>
                  <option value="theft">Theft / Pickpocketing</option>
                  <option value="stalking">Stalking / Suspicious Activity</option>
                  <option value="poor-lighting">Poor Street Lighting</option>
                  <option value="other">Other Hazard</option>
                </select>
              </div>

              {/* Time of Day */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-dark-heading tracking-wider">PRIMARY TIME OF OCCURRENCE</label>
                <div className="grid grid-cols-4 gap-2">
                  {['morning', 'afternoon', 'evening', 'night'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setReportForm(prev => ({ ...prev, timeOfDay: t }))}
                      className={`py-2 text-[10px] font-bold tracking-wider capitalize rounded-lg border interactive-transition ${
                        reportForm.timeOfDay === t
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-dark-body border-border-soft hover:bg-background-warm'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action trigger button */}
              <button
                type="submit"
                disabled={submittingReport}
                className="w-full bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-bold py-3.5 rounded-full shadow-md shadow-primary/10 interactive-transition mt-3 flex items-center justify-center gap-2"
              >
                {submittingReport ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <AlertOctagon size={18} />
                    <span>Submit Anonymous Report</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer bottom navigation bar */}
      <BottomNav />
    </div>
  );
};

export default CommunityMap;
