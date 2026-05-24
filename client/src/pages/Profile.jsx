import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut, ChevronRight, PhoneCall, HelpCircle, EyeOff, Save, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import BottomNav from '../components/BottomNav.jsx';

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout, updateEmergencyMessage } = useAuth();

  // Local state controls
  const [emergencyText, setEmergencyText] = useState(user?.emergencyMessage || 'I need help. This is my live location.');
  const [savingMsg, setSavingMsg] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // App Disguise settings (UI ONLY)
  const [disguiseEnabled, setDisguiseEnabled] = useState(false);

  const handleSaveMessage = async () => {
    setSavingMsg(true);
    const res = await updateEmergencyMessage(emergencyText);
    setSavingMsg(false);

    if (res.success) {
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 2000);
      if (navigator.vibrate) navigator.vibrate(50);
    } else {
      alert(res.error);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out of SafeNet?')) {
      logout();
      navigate('/');
    }
  };

  return (
    <div className="phone-container page-transition bg-background-warm pb-24 relative">
      
      {/* Save Success Toast */}
      {showSavedToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 z-50 animate-fade-in-up">
          <CheckCircle size={14} />
          <span>Emergency message saved!</span>
        </div>
      )}

      {/* Top Banner Profile card */}
      <section className="bg-white border-b border-border-soft px-6 pt-8 pb-6 shadow-soft flex flex-col items-center text-center">
        
        {/* User initials Avatar */}
        <div className="w-18 h-18 bg-gradient-to-tr from-primary to-secondary text-white font-extrabold text-2xl rounded-full flex items-center justify-center shadow-md mb-3 border-2 border-white">
          {user?.name ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2) : 'U'}
        </div>

        <h3 className="text-lg font-bold text-dark-heading leading-tight">{user?.name || 'SafeNet User'}</h3>
        <p className="text-xs text-dark-muted mt-1 leading-none">{user?.email || 'user@safenet.com'}</p>

        {/* Profile Stats */}
        <div className="flex gap-4 mt-5 w-full">
          <button
            onClick={() => navigate('/contacts')}
            className="flex-1 bg-background-warm border border-border-soft/60 hover:border-primary/20 hover:bg-white rounded-xl p-3 flex items-center justify-between interactive-transition"
          >
            <div className="text-left">
              <span className="text-[10px] font-bold text-dark-muted tracking-wider uppercase">TRUSTED CONTACTS</span>
              <p className="text-sm font-extrabold text-dark-heading leading-tight mt-0.5">{user?.trustedContacts?.length || 0} Saved</p>
            </div>
            <ChevronRight size={16} className="text-dark-muted" />
          </button>
        </div>
      </section>

      {/* Settings Options container */}
      <main className="px-6 py-6 flex flex-col gap-6">
        
        {/* Emergency message configuration card */}
        <div className="bg-white border border-border-soft rounded-2xl p-5 shadow-card flex flex-col gap-3">
          <label className="text-xs font-bold text-dark-heading tracking-wider flex items-center gap-1.5">
            <ShieldCheck size={16} className="text-primary" />
            <span>EDIT EMERGENCY SOS MESSAGE</span>
          </label>
          <textarea
            value={emergencyText}
            onChange={(e) => setEmergencyText(e.target.value)}
            rows={3}
            placeholder="Type your emergency instructions..."
            className="w-full bg-background-warm border border-border-soft focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-xs text-dark-body outline-none interactive-transition leading-relaxed resize-none"
          />
          <button
            onClick={handleSaveMessage}
            disabled={savingMsg}
            className="self-end bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-md shadow-primary/10 interactive-transition flex items-center gap-1.5"
          >
            {savingMsg ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save size={14} />
                <span>Save Message</span>
              </>
            )}
          </button>
        </div>

        {/* Fake Call activation card */}
        <div className="bg-white border border-border-soft rounded-2xl p-5 shadow-card flex justify-between items-center hover:border-primary/20 interactive-transition">
          <div className="flex gap-4 items-start">
            <div className="w-11 h-11 bg-accent-light border border-accent/15 rounded-xl flex items-center justify-center shrink-0">
              <PhoneCall size={20} className="text-accent" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-dark-heading leading-tight">Test Fake Call</h4>
              <p className="text-[10px] text-dark-muted mt-1 leading-relaxed max-w-[200px]">
                Simulate an incoming phone call to excuse yourself from uncomfortable surroundings.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/fake-call')}
            className="bg-accent hover:bg-accent-hover text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-safe interactive-transition"
          >
            Trigger
          </button>
        </div>

        {/* App Disguise Setup instruction toggling */}
        <div className="bg-white border border-border-soft rounded-2xl p-5 shadow-card flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-4 items-start">
              <div className="w-11 h-11 bg-secondary-light border border-secondary/15 rounded-xl flex items-center justify-center shrink-0">
                <EyeOff size={20} className="text-secondary" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-dark-heading leading-tight">Disguise App Icon</h4>
                <p className="text-[10px] text-dark-muted mt-1 leading-relaxed">
                  Mask SafeNet as a Calculator or Weather shortcut.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={disguiseEnabled}
                onChange={() => setDisguiseEnabled(prev => !prev)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-dark-muted/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>

          {/* Instructions Drawer overlay */}
          {disguiseEnabled && (
            <div className="border-t border-border-soft/60 pt-3 flex flex-col gap-2.5 animate-fade-in-up">
              <h5 className="text-[11px] font-bold text-dark-heading flex items-center gap-1">
                <HelpCircle size={14} className="text-secondary" />
                <span>How to disguise the web app:</span>
              </h5>
              <ol className="list-decimal pl-4 text-[10px] text-dark-body font-medium flex flex-col gap-2 leading-relaxed">
                <li>
                  Open SafeNet in your mobile browser (Safari on iOS or Chrome on Android).
                </li>
                <li>
                  Tap the <strong>Share</strong> (iOS) or <strong>Menu</strong> (Android) icon.
                </li>
                <li>
                  Select <strong>"Add to Home Screen"</strong> from the action options.
                </li>
                <li>
                  Change the name to <strong>"CalcuSafe"</strong> or <strong>"Daily Weather"</strong>, then save it.
                </li>
                <li>
                  SafeNet will now run in full-screen standalone mode showing a calming, private calculator icon.
                </li>
              </ol>
            </div>
          )}
        </div>

        {/* Account Logout Action trigger button */}
        <button
          onClick={handleLogout}
          className="w-full bg-white hover:bg-primary-light text-primary border border-primary/20 hover:border-primary/40 font-semibold py-3.5 rounded-full interactive-transition mt-4 flex items-center justify-center gap-2"
        >
          <LogOut size={16} />
          <span>Sign Out of SafeNet</span>
        </button>

      </main>

      {/* Footer bottom navigation bar */}
      <BottomNav />
    </div>
  );
};

export default Profile;
