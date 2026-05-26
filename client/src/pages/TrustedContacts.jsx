import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, UserPlus, Trash2, Mail, Phone, ShieldCheck, HelpCircle, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';

const TrustedContacts = () => {
  const navigate = useNavigate();
  const { user, updateTrustedContacts, refreshProfile } = useAuth();

  // Add Contact Form States
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', priority: 'primary' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [testingEmail, setTestingEmail] = useState(null); // stores email currently testing

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.name.trim()) newErrors.name = 'Contact name is required.';
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required.';
    } else if (formData.phone.trim().length < 8) {
      newErrors.phone = 'Enter a valid phone number.';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Enter a valid email address.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const currentContacts = user?.trustedContacts || [];
    if (currentContacts.length >= 5) {
      alert('You can only have a maximum of 5 trusted contacts.');
      return;
    }

    // Double check email duplicate
    if (currentContacts.some((c) => c.email.toLowerCase() === formData.email.toLowerCase())) {
      setErrors({ email: 'A contact with this email already exists.' });
      return;
    }

    setSubmitting(true);
    const updatedList = [...currentContacts, formData];
    
    const res = await updateTrustedContacts(updatedList);
    setSubmitting(false);

    if (res.success) {
      setFormData({ name: '', phone: '', email: '', priority: 'primary' });
      setShowAddForm(false);
      refreshProfile(); // Sync details
      if (navigator.vibrate) navigator.vibrate(50);
    } else {
      alert(res.error);
    }
  };

  const handleDeleteContact = async (email) => {
    if (!window.confirm('Are you sure you want to delete this trusted contact?')) return;

    const currentContacts = user?.trustedContacts || [];
    const updatedList = currentContacts.filter((c) => c.email !== email);

    if (navigator.vibrate) navigator.vibrate(80);

    const res = await updateTrustedContacts(updatedList);
    if (res.success) {
      refreshProfile();
    } else {
      alert(res.error);
    }
  };

  const handleTestAlert = async (email) => {
    setTestingEmail(email);
    try {
      const res = await api.post('/api/user/test-contact', { email });
      alert(res.data.message || 'Test alert email sent successfully!');
    } catch (err) {
      alert(err.parsedMessage || 'Failed to dispatch test alert email.');
    } finally {
      setTestingEmail(null);
    }
  };

  return (
    <div className="phone-container page-transition bg-background-warm pb-8">
      
      {/* Header element */}
      <header className="w-full bg-white border-b border-border-soft px-6 py-5 flex items-center justify-between shadow-soft">
        <button
          onClick={() => navigate('/profile')}
          className="p-2 -ml-2 rounded-full hover:bg-background-warm text-dark-body interactive-transition"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-base font-bold text-dark-heading">Trusted Contacts</h2>
        <div className="w-8" />
      </header>

      <main className="flex-1 p-6 flex flex-col gap-6">
        
        {/* Dynamic Sandbox Daily Email Cap Card (Model B) */}
        <div className="bg-white border border-border-soft rounded-2xl p-4 shadow-card flex flex-col gap-3.5">
          <div className="flex items-start gap-3">
            <HelpCircle size={20} className="text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-dark-body leading-relaxed">
              Your trusted contacts are your safety net. They receive live tracking links during an active SOS and alerts if you miss a check-in.
            </p>
          </div>
        </div>

        {/* Contacts Core list */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-dark-heading tracking-wider">
              YOUR SAVED CONTACTS ({user?.trustedContacts?.length || 0}/5)
            </label>
            {(!user?.trustedContacts || user.trustedContacts.length < 5) && (
              <button
                onClick={() => setShowAddForm(true)}
                className="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1 interactive-transition"
              >
                <UserPlus size={14} />
                <span>Add Contact</span>
              </button>
            )}
          </div>

          {(!user?.trustedContacts || user.trustedContacts.length === 0) ? (
            <div className="bg-white border border-border-soft rounded-2xl p-8 text-center shadow-card flex flex-col items-center justify-center gap-2">
              <Phone size={32} className="text-dark-muted/40 animate-pulse" />
              <p className="text-xs font-medium text-dark-muted">No trusted contacts added yet.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="text-xs font-bold text-primary hover:text-primary-hover underline mt-1"
              >
                Add your first contact
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {user.trustedContacts.map((contact) => (
                <div
                  key={contact.email}
                  className="bg-white border border-border-soft rounded-2xl p-4 shadow-card flex justify-between items-center group relative hover:border-primary/20 interactive-transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-primary-light text-primary font-bold text-sm rounded-full flex items-center justify-center shadow-sm">
                      {contact.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-dark-heading leading-tight">{contact.name}</h4>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          contact.priority === 'secondary'
                            ? 'bg-secondary-light text-secondary border-secondary/10'
                            : 'bg-primary-light text-primary border-primary/10'
                        }`}>
                          {contact.priority === 'secondary' ? 'Secondary' : 'Primary'}
                        </span>
                      </div>
                      <p className="text-[10px] text-dark-muted mt-1.5 flex items-center gap-1">
                        <Phone size={10} /> {contact.phone}
                      </p>
                      <p className="text-[10px] text-dark-muted mt-0.5 flex items-center gap-1">
                        <Mail size={10} /> {contact.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Test alert trigger */}
                    <button
                      onClick={() => handleTestAlert(contact.email)}
                      disabled={testingEmail !== null}
                      className="text-[10px] font-bold text-secondary hover:text-secondary-hover bg-secondary-light border border-secondary/15 rounded-full px-2.5 py-1.5 flex items-center gap-1.5 interactive-transition"
                    >
                      {testingEmail === contact.email ? (
                        <span className="w-3 h-3 border border-secondary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send size={10} />
                      )}
                      <span>Test Alert</span>
                    </button>

                    {/* Trash Delete */}
                    <button
                      onClick={() => handleDeleteContact(contact.email)}
                      className="p-2 rounded-full hover:bg-primary-light text-dark-muted hover:text-primary border border-border-soft/60 interactive-transition"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Contact Modal drawer */}
      {showAddForm && (
        <div className="absolute inset-0 bg-dark-heading/35 backdrop-blur-xs flex items-end justify-center z-50 animate-fade-in-up">
          <div className="w-full max-w-[430px] bg-white rounded-t-3xl p-6 shadow-2xl border-t border-border-soft flex flex-col gap-4">
            
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-dark-heading flex items-center gap-2">
                <UserPlus size={18} className="text-primary" />
                <span>Add Trusted Contact</span>
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-xs font-bold text-dark-muted hover:text-dark-body interactive-transition p-1 rounded-full hover:bg-background-warm"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddContact} className="flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-dark-heading tracking-wider">FULL NAME</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter name"
                  className={`w-full bg-white border ${
                    errors.name ? 'border-primary' : 'border-border-soft'
                  } focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-xs text-dark-body outline-none interactive-transition`}
                />
                {errors.name && <span className="text-[10px] font-medium text-primary mt-0.5">{errors.name}</span>}
              </div>

              {/* Phone */}
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
                  } focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-xs text-dark-body outline-none interactive-transition`}
                />
                {errors.phone && <span className="text-[10px] font-medium text-primary mt-0.5">{errors.phone}</span>}
              </div>

              {/* Email */}
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
                  } focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-xs text-dark-body outline-none interactive-transition`}
                />
                {errors.email && <span className="text-[10px] font-medium text-primary mt-0.5">{errors.email}</span>}
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-dark-heading tracking-wider">CONTACT ESCALATION PRIORITY</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full bg-white border border-border-soft focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-xs text-dark-body outline-none interactive-transition"
                >
                  <option value="primary">🎯 Primary (Notify Instantly)</option>
                  <option value="secondary">⏳ Secondary (Notify after 10m delay)</option>
                </select>
              </div>

              {/* Submit add */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white font-bold py-3.5 rounded-full shadow-md shadow-primary/10 interactive-transition mt-3 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Save Contact</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrustedContacts;
