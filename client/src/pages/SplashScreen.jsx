import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const SplashScreen = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    // If user session is authenticated, auto-redirect to Home dashboard
    if (!loading && isAuthenticated) {
      navigate('/home');
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="phone-container page-transition bg-gradient-to-b from-[#FFF1F2] via-[#FFF7F7] to-white flex flex-col justify-between p-8 pb-12">
      {/* Top spacing */}
      <div />

      {/* Main branding core */}
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/20 mb-6 animate-pulse">
          <Shield size={40} className="text-white" strokeWidth={2} />
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-dark-heading mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
          SafeNet
        </h1>
        <p className="text-dark-body font-medium text-base tracking-wide max-w-[280px]">
          Your safety, always connected.
        </p>
      </div>

      {/* Action triggers */}
      <div className="flex flex-col gap-4 w-full px-2">
        <button
          onClick={() => navigate('/auth?mode=register')}
          className="w-full bg-primary hover:bg-primary-hover text-white text-base font-semibold py-4 rounded-full shadow-lg shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
        >
          Get Started
        </button>
        <button
          onClick={() => navigate('/auth?mode=login')}
          className="w-full bg-white hover:bg-background-warm text-primary border-2 border-primary/20 text-base font-semibold py-4 rounded-full transition-all duration-200 hover:border-primary/40 active:translate-y-0"
        >
          Log In
        </button>
        
        <p className="text-[11px] text-dark-muted text-center mt-4 px-4 leading-relaxed">
          By continuing, you agree to SafeNet's Terms of Service and Privacy Policy. Privacy by design — your exact coords are fuzzed.
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
