import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const LoginRegister = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, isAuthenticated, loading: authLoading } = useAuth();

  // Determine mode from query parameters, default to login
  const [isRegister, setIsRegister] = useState(searchParams.get('mode') === 'register');
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: ''
  });

  // Client Validation Errors
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/home');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Handle URL change triggers
  useEffect(() => {
    setIsRegister(searchParams.get('mode') === 'register');
    setErrors({});
    setApiError('');
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear inline error on type
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (isRegister) {
      if (!formData.name.trim()) newErrors.name = 'Full name is required.';
      if (!formData.phone.trim()) {
        newErrors.phone = 'Phone number is required.';
      } else if (formData.phone.trim().length < 8) {
        newErrors.phone = 'Please enter a valid phone number.';
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
    } else if (isRegister) {
      // Strong password validation rules on registration
      if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters long.';
      } else if (!/[A-Z]/.test(formData.password)) {
        newErrors.password = 'Password must contain at least one uppercase letter (A-Z).';
      } else if (!/[a-z]/.test(formData.password)) {
        newErrors.password = 'Password must contain at least one lowercase letter (a-z).';
      } else if (!/\d/.test(formData.password)) {
        newErrors.password = 'Password must contain at least one number (0-9).';
      } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
        newErrors.password = 'Password must contain at least one special character (e.g. !, @, #, $, %).';
      }
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validateForm()) return;

    setSubmitting(true);
    if (isRegister) {
      const res = await register(formData.name, formData.phone, formData.email, formData.password);
      if (res.success) {
        navigate('/home');
      } else {
        setApiError(res.error);
      }
    } else {
      const res = await login(formData.email, formData.password);
      if (res.success) {
        navigate('/home');
      } else {
        setApiError(res.error);
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="phone-container page-transition bg-background-warm flex flex-col justify-center px-6 py-8">
      {/* Top Header branding */}
      <div className="flex flex-col items-center mb-8">
        <div
          onClick={() => navigate('/')}
          className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-md cursor-pointer hover:scale-105 interactive-transition mb-3"
        >
          <Shield size={24} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-dark-heading">
          {isRegister ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p className="text-sm text-dark-muted mt-1">
          {isRegister ? 'Join SafeNet to secure your journeys' : 'Enter your credentials to secure your session'}
        </p>
      </div>

      {/* Main card panel */}
      <div className="bg-white border border-border-soft rounded-2xl p-6 shadow-card w-full">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* API/Network Error Alert */}
          {apiError && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-2.5 text-primary text-xs leading-relaxed animate-shake">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Name Field (Register Mode only) */}
          {isRegister && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-dark-heading tracking-wider">FULL NAME</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your name"
                className={`w-full bg-white border ${
                  errors.name ? 'border-primary' : 'border-border-soft'
                } focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-sm text-dark-body outline-none interactive-transition`}
              />
              {errors.name && <span className="text-[11px] font-medium text-primary mt-0.5">{errors.name}</span>}
            </div>
          )}

          {/* Phone Field (Register Mode only) */}
          {isRegister && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-dark-heading tracking-wider">PHONE NUMBER</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
                className={`w-full bg-white border ${
                  errors.phone ? 'border-primary' : 'border-border-soft'
                } focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-sm text-dark-body outline-none interactive-transition`}
              />
              {errors.phone && <span className="text-[11px] font-medium text-primary mt-0.5">{errors.phone}</span>}
            </div>
          )}

          {/* Email Field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-dark-heading tracking-wider">EMAIL ADDRESS</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="name@domain.com"
              className={`w-full bg-white border ${
                errors.email ? 'border-primary' : 'border-border-soft'
              } focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-sm text-dark-body outline-none interactive-transition`}
            />
            {errors.email && <span className="text-[11px] font-medium text-primary mt-0.5">{errors.email}</span>}
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-dark-heading tracking-wider">PASSWORD</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••"
                className={`w-full bg-white border ${
                  errors.password ? 'border-primary' : 'border-border-soft'
                } focus:border-primary focus:ring-1 focus:ring-primary rounded-xl pl-4 pr-11 py-3 text-sm text-dark-body outline-none interactive-transition`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-body interactive-transition"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <span className="text-[11px] font-medium text-primary mt-0.5">{errors.password}</span>}
          </div>

          {/* Forgot password trigger (UI ONLY) */}
          {!isRegister && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => alert('Forgot password helper: A password reset sequence is being integrated. Please contact support.')}
                className="text-[11px] font-semibold text-primary hover:text-primary-hover tracking-wide outline-none interactive-transition"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {/* Submit Trigger */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-semibold py-3.5 rounded-full shadow-md shadow-primary/10 interactive-transition mt-2 flex items-center justify-center"
          >
            {submitting ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isRegister ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>

      {/* Switch trigger links */}
      <p className="text-center text-xs text-dark-body mt-6">
        {isRegister ? 'Already have an account? ' : "Don't have an account? "}
        <button
          onClick={() => {
            setIsRegister((prev) => !prev);
            navigate(`/auth?mode=${!isRegister ? 'register' : 'login'}`);
          }}
          className="text-primary hover:text-primary-hover font-semibold underline decoration-2 outline-none interactive-transition"
        >
          {isRegister ? 'Log In' : 'Sign Up'}
        </button>
      </p>
    </div>
  );
};

export default LoginRegister;
