import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, Mic, Volume2, Grid, User, Video, Shield } from 'lucide-react';

const FakeCallScreen = () => {
  const navigate = useNavigate();
  const [callState, setCallState] = useState('ringing'); // ringing | connected | ended
  const [callerName, setCallerName] = useState('Mom');
  const [customNameInput, setCustomNameInput] = useState('');
  const [seconds, setSeconds] = useState(0);

  const vibrationInterval = useRef(null);
  const callTimer = useRef(null);
  const audioContextRef = useRef(null);
  const ringtoneInterval = useRef(null);
  const ringtoneAudioContext = useRef(null);

  // Trigger vibration and ringtone on mount during ringing phase
  useEffect(() => {
    if (callState === 'ringing') {
      triggerVibration();
      startRingtone();
    } else {
      stopVibration();
      stopRingtone();
    }

    return () => {
      stopVibration();
      stopRingtone();
      if (callTimer.current) clearInterval(callTimer.current);
    };
  }, [callState]);

  // Manage call timer once connected
  useEffect(() => {
    if (callState === 'connected') {
      callTimer.current = setInterval(() => {
        setSeconds((prev) => {
          // Auto hang up and play busy tone after 5 seconds of connection
          if (prev >= 5) {
            clearInterval(callTimer.current);
            handleCallExpiry();
            return 5;
          }
          return prev + 1;
        });
      }, 1000);
    }

    return () => {
      if (callTimer.current) clearInterval(callTimer.current);
    };
  }, [callState]);

  const triggerVibration = () => {
    if ('vibrate' in navigator) {
      // Vibrate 500ms, pause 200ms, repeat
      navigator.vibrate([500, 200, 500, 200, 500]);
      vibrationInterval.current = setInterval(() => {
        navigator.vibrate([500, 200, 500, 200, 500]);
      }, 2000);
    }
  };

  const stopVibration = () => {
    if (vibrationInterval.current) {
      clearInterval(vibrationInterval.current);
      vibrationInterval.current = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  };

  // Synthesize a high-quality dual-tone telephone double-ring (chirp-chirp)
  const playRingtoneRound = (ctx) => {
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      
      const playChirp = (startTime, duration) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc1.type = 'sine';
        osc2.type = 'sine';
        
        // Pleasant digital emergency/security telephone ringing frequencies
        osc1.frequency.setValueAtTime(850, startTime);
        osc2.frequency.setValueAtTime(950, startTime);
        
        // Rapid vibrato frequency sweep for authentic telephone warble!
        osc1.frequency.exponentialRampToValueAtTime(900, startTime + duration);
        osc2.frequency.exponentialRampToValueAtTime(1000, startTime + duration);
        
        gainNode.gain.setValueAtTime(0, startTime);
        // Smooth ramp up
        gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
        
        // Amplitude modulation for beautiful warbling effect
        const warbleCount = 8;
        const step = duration / warbleCount;
        for (let i = 0; i < warbleCount; i++) {
          const t = startTime + i * step;
          gainNode.gain.setValueAtTime(0.2, t);
          gainNode.gain.setValueAtTime(0.05, t + step / 2);
        }
        
        // Smooth ramp down
        gainNode.gain.setValueAtTime(0.2, startTime + duration - 0.05);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc1.start(startTime);
        osc2.start(startTime);
        
        osc1.stop(startTime + duration);
        osc2.stop(startTime + duration);
      };

      // standard double-chirp ringback pattern: Chirp 1 (0.45s), pause (0.2s), Chirp 2 (0.45s)
      playChirp(now, 0.45);
      playChirp(now + 0.65, 0.45);
    } catch (err) {
      console.warn('Error playing ringtone round:', err);
    }
  };

  const startRingtone = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      
      const audioCtx = new AudioContextClass();
      ringtoneAudioContext.current = audioCtx;
      
      // Play first round immediately
      playRingtoneRound(audioCtx);
      
      // Repeat every 3 seconds (double ring sequence takes ~1.1s, leaving a realistic 1.9s pause)
      ringtoneInterval.current = setInterval(() => {
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        playRingtoneRound(audioCtx);
      }, 3000);
    } catch (e) {
      console.warn('Ringtone AudioContext creation failed:', e.message);
    }
  };

  const stopRingtone = () => {
    if (ringtoneInterval.current) {
      clearInterval(ringtoneInterval.current);
      ringtoneInterval.current = null;
    }
    if (ringtoneAudioContext.current) {
      try {
        if (ringtoneAudioContext.current.state !== 'closed') {
          ringtoneAudioContext.current.close();
        }
      } catch (e) {
        console.warn('Error closing ringtone context:', e);
      }
      ringtoneAudioContext.current = null;
    }
  };

  // Synthesize a retro busy telephone beep sound using Web Audio API!
  const playBusyTone = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      
      const beep = (delay) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.frequency.value = 480; // retro busy tone frequency combination
        gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + delay + 0.05);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime + delay + 0.4);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + delay + 0.45);
        
        osc.start(audioCtx.currentTime + delay);
        osc.stop(audioCtx.currentTime + delay + 0.5);
      };

      // Play 3 rapid busy tones
      beep(0);
      beep(0.8);
      beep(1.6);

      setTimeout(() => {
        audioCtx.close();
      }, 2500);

    } catch (e) {
      console.warn('Audio Synthesis failed or unsupported:', e.message);
    }
  };

  const handleAccept = () => {
    if (navigator.vibrate) navigator.vibrate(60);
    setCallState('connected');
    setSeconds(0);
  };

  const handleDecline = () => {
    stopVibration();
    setCallState('ended');
    if (navigator.vibrate) navigator.vibrate(100);
    setTimeout(() => {
      navigate('/profile');
    }, 500);
  };

  const handleCallExpiry = () => {
    setCallState('ended');
    // Play retro telephone busy beeps
    playBusyTone();
    // Return back to profile dashboard after 2.5 seconds
    setTimeout(() => {
      navigate('/profile');
    }, 2500);
  };

  // Formatter helper
  const formatCallDuration = (sec) => {
    return `00:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="phone-container page-transition bg-white flex flex-col justify-between p-8 pb-16 h-screen select-none relative z-50">
      
      {/* 1. Configuration Panel (Visible only during setup/ringing at top of viewport for easy testing) */}
      {callState === 'ringing' && (
        <div className="w-full bg-background-warm border border-border-soft rounded-2xl p-4 shadow-sm z-30 animate-fade-in-up">
          <label className="text-[10px] font-bold text-dark-heading tracking-wider block mb-1">
            TESTING: CHANGE INCOMING CALLER NAME
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customNameInput}
              onChange={(e) => setCustomNameInput(e.target.value)}
              placeholder="e.g. Mom, Boss, Hubby..."
              className="flex-1 bg-white border border-border-soft rounded-lg px-3 py-1.5 text-xs text-dark-body outline-none"
            />
            <button
              onClick={() => {
                if (customNameInput.trim()) {
                  setCallerName(customNameInput.trim());
                  setCustomNameInput('');
                }
              }}
              className="bg-primary hover:bg-primary-hover text-white text-[10px] font-bold px-3 py-1.5 rounded-lg interactive-transition"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Top spacing placeholder */}
      {callState !== 'ringing' && <div />}

      {/* 2. Main Caller Branding Card */}
      <div className="flex flex-col items-center text-center mt-12">
        <div className="w-24 h-24 bg-dark-muted/10 rounded-full flex items-center justify-center border-2 border-border-soft mb-6 relative">
          <User size={48} className="text-dark-muted" />
          {callState === 'ringing' && (
            <span className="absolute inset-0 rounded-full border-4 border-primary/40 animate-ping" />
          )}
        </div>
        
        <h2 className="text-3xl font-bold text-dark-heading tracking-tight">
          {callerName}
        </h2>
        
        <p className="text-sm font-semibold tracking-wide text-dark-muted mt-2 uppercase">
          {callState === 'ringing' && 'Incoming Call...'}
          {callState === 'connected' && formatCallDuration(seconds)}
          {callState === 'ended' && 'Call Ended (Busy Tone)'}
        </p>
      </div>

      {/* 3. Mid-screen button grids (iOS style mute/speaker pads - visible during connection) */}
      {callState === 'connected' && (
        <div className="grid grid-cols-3 gap-6 max-w-[280px] mx-auto w-full my-6 text-center animate-fade-in-up">
          {[
            { label: 'Mute', icon: Mic },
            { label: 'Keypad', icon: Grid },
            { label: 'Audio', icon: Volume2 },
            { label: 'Video', icon: Video },
            { label: 'Shield', icon: Shield },
          ].map((pad, idx) => {
            const Icon = pad.icon;
            return (
              <div key={idx} className="flex flex-col items-center gap-1.5">
                <button className="w-12 h-12 bg-background-warm rounded-full flex items-center justify-center text-dark-body hover:bg-border-soft interactive-transition border border-border-soft/40">
                  <Icon size={18} />
                </button>
                <span className="text-[10px] font-bold text-dark-muted">{pad.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Action Calls Dial pad buttons */}
      <div className="w-full max-w-[320px] mx-auto">
        
        {/* Ringing: green accept & red decline */}
        {callState === 'ringing' && (
          <div className="flex justify-around items-center w-full animate-fade-in-up">
            
            {/* Decline Trigger */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleDecline}
                className="w-16 h-16 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 interactive-transition border-2 border-white"
              >
                <PhoneOff size={24} />
              </button>
              <span className="text-xs font-bold text-dark-muted">Decline</span>
            </div>

            {/* Accept Trigger */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleAccept}
                className="w-16 h-16 bg-accent hover:bg-accent-hover text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 interactive-transition border-2 border-white animate-bounce"
              >
                <Phone size={24} />
              </button>
              <span className="text-xs font-bold text-dark-muted">Accept</span>
            </div>
          </div>
        )}

        {/* Connected: single red decline hang-up button */}
        {callState === 'connected' && (
          <div className="flex flex-col items-center gap-2 w-full animate-fade-in-up">
            <button
              onClick={handleDecline}
              className="w-16 h-16 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 interactive-transition border-2 border-white"
            >
              <PhoneOff size={24} />
            </button>
            <span className="text-xs font-bold text-dark-muted">Hang Up</span>
          </div>
        )}

        {/* Ended: display simple return alert */}
        {callState === 'ended' && (
          <div className="text-center font-bold text-xs text-dark-muted animate-pulse">
            Redirecting to settings dashboard...
          </div>
        )}

      </div>
    </div>
  );
};

export default FakeCallScreen;
